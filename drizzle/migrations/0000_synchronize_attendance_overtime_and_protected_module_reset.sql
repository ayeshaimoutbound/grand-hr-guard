CREATE OR REPLACE FUNCTION public.sync_company_month(p_company uuid, p_month date, create_records boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; r record; lines jsonb; subtotal numeric; period_text text; ot_hours numeric; first_day date := date_trunc('month',p_month)::date; last_day date := (date_trunc('month',p_month) + interval '1 month - 1 day')::date;
BEGIN
  SELECT co.*, COALESCE(h.pay_oic,co.pay_oic) AS poic, COALESCE(h.pay_sso,co.pay_sso) AS psso, COALESCE(h.pay_jso,co.pay_jso) AS pjso, COALESCE(h.pay_lso,co.pay_lso) AS plso, COALESCE(h.charge_oic,co.charge_oic) AS coic, COALESCE(h.charge_sso,co.charge_sso) AS csso, COALESCE(h.charge_jso,co.charge_jso) AS cjso, COALESCE(h.charge_lso,co.charge_lso) AS clso, COALESCE(h.client_ot_rate,co.client_ot_rate) AS otrate INTO c FROM public.companies co LEFT JOIN LATERAL (SELECT * FROM public.company_rate_history WHERE company_id=co.id AND effective_month<=first_day ORDER BY effective_month DESC LIMIT 1) h ON true WHERE co.id=p_company;
  IF NOT FOUND THEN RETURN; END IF;
  period_text := to_char(first_day,'DD') || '-' || upper(to_char(last_day,'DD MON YY'));
  SELECT COALESCE(jsonb_agg(jsonb_build_object('period',period_text,'rank',rank,'officers',CASE WHEN shift_type='Day' THEN '1 X DAY' ELSE '1 X NIGHT' END,'shifts',shifts,'rate',rate,'amount',shifts*rate) ORDER BY rank,shift_type),'[]'::jsonb), COALESCE(sum(shifts*rate),0) INTO lines,subtotal FROM (SELECT rank,shift_type,count(*) AS shifts, CASE rank WHEN 'OIC' THEN c.coic WHEN 'SSO' THEN c.csso WHEN 'JSO' THEN c.cjso ELSE c.clso END AS rate FROM public.attendance WHERE company_id=p_company AND attendance_date BETWEEN first_day AND last_day AND present=true GROUP BY rank,shift_type) counts;
  SELECT COALESCE(sum(hours),0) INTO ot_hours FROM public.overtime_entries WHERE company_id=p_company AND ot_date BETWEEN first_day AND last_day;
  IF ot_hours>0 AND c.otrate>0 THEN
    lines := lines || jsonb_build_array(jsonb_build_object('period',period_text,'rank','OVERTIME','officers','Hours','shifts',ot_hours,'rate',c.otrate,'amount',round(ot_hours*c.otrate,2)));
    subtotal := subtotal + round(ot_hours*c.otrate,2);
  END IF;
  UPDATE public.invoices SET amount_to_collect=subtotal, invoice_data=COALESCE(invoice_data,'{}'::jsonb) || jsonb_build_object('lineItems',lines,'subtotal',subtotal,'grandTotal',subtotal,'sscl',0,'vat',0) WHERE company_id=p_company AND month_period=first_day;
  IF create_records AND NOT EXISTS(SELECT 1 FROM public.invoices WHERE company_id=p_company AND month_period=first_day) AND jsonb_array_length(lines)>0 THEN
    IF c.company_number IS NULL OR trim(c.company_number)='' THEN RAISE EXCEPTION 'Company number is required before creating an invoice'; END IF;
    INSERT INTO public.invoices(company_id,month_period,invoice_date,invoice_number,amount_to_collect,amount_received,invoice_data,created_by) VALUES(p_company,first_day,(now() AT TIME ZONE 'Asia/Colombo')::date,c.company_number || '-' || to_char(first_day,'MM-YY'),subtotal,0,jsonb_build_object('lineItems',lines,'subtotal',subtotal,'grandTotal',subtotal),auth.uid());
  END IF;
  FOR r IN SELECT emp.id AS employee_id, COALESCE(a.shifts,0) AS shifts, COALESCE(a.gross,0) AS gross, COALESCE(o.ot,0) AS ot FROM public.employees emp LEFT JOIN LATERAL (SELECT count(*) AS shifts, sum(COALESCE(ov.pay_rate,CASE att.rank WHEN 'OIC' THEN c.poic WHEN 'SSO' THEN c.psso WHEN 'JSO' THEN c.pjso ELSE c.plso END)) AS gross FROM public.attendance att LEFT JOIN public.employee_rate_overrides ov ON ov.employee_id=att.employee_id AND ov.company_id=att.company_id AND ov.rank=att.rank WHERE att.employee_id=emp.id AND att.company_id=p_company AND att.present=true AND att.attendance_date BETWEEN first_day AND last_day) a ON true LEFT JOIN LATERAL (SELECT sum(amount) AS ot FROM public.overtime_entries WHERE employee_id=emp.id AND company_id=p_company AND ot_date BETWEEN first_day AND last_day) o ON true WHERE a.shifts>0 OR o.ot>0 OR EXISTS(SELECT 1 FROM public.salaries WHERE employee_id=emp.id AND company_id=p_company AND salary_month=first_day)
  LOOP
    UPDATE public.salaries SET total_shifts=r.shifts,pay_per_shift=CASE WHEN r.shifts>0 THEN r.gross/r.shifts ELSE 0 END,gross_shift_total=r.gross,epf=COALESCE(basic_salary,0)*0.08,final_salary=r.gross+r.ot-COALESCE(basic_salary,0)*0.08-COALESCE(salary_advance,0)-COALESCE(salary_advance_2,0)-COALESCE(food,0)-COALESCE(uniforms,0)-COALESCE(transport,0)-COALESCE(other_deductions,0) WHERE employee_id=r.employee_id AND company_id=p_company AND salary_month=first_day;
    IF create_records AND NOT EXISTS(SELECT 1 FROM public.salaries WHERE employee_id=r.employee_id AND company_id=p_company AND salary_month=first_day) THEN
      INSERT INTO public.salaries(employee_id,company_id,salary_month,total_shifts,pay_per_shift,gross_shift_total,basic_salary,epf,final_salary,created_by) VALUES(r.employee_id,p_company,first_day,r.shifts,CASE WHEN r.shifts>0 THEN r.gross/r.shifts ELSE 0 END,r.gross,0,0,r.gross+r.ot,auth.uid());
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.sync_company_month(uuid,date,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_company_month(uuid,date,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_attendance_ot_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_date date; new_date date;
BEGIN
 IF TG_OP<>'INSERT' THEN old_date := CASE WHEN TG_TABLE_NAME='attendance' THEN (to_jsonb(OLD)->>'attendance_date')::date ELSE (to_jsonb(OLD)->>'ot_date')::date END; PERFORM public.sync_company_month(OLD.company_id,old_date,false); END IF;
 IF TG_OP<>'DELETE' THEN new_date := CASE WHEN TG_TABLE_NAME='attendance' THEN (to_jsonb(NEW)->>'attendance_date')::date ELSE (to_jsonb(NEW)->>'ot_date')::date END; IF TG_OP='INSERT' OR NEW.company_id IS DISTINCT FROM OLD.company_id OR date_trunc('month',new_date) IS DISTINCT FROM date_trunc('month',old_date) THEN PERFORM public.sync_company_month(NEW.company_id,new_date,false); END IF; END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER attendance_sync_totals AFTER INSERT OR UPDATE OR DELETE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.sync_attendance_ot_change();
CREATE TRIGGER overtime_sync_totals AFTER INSERT OR UPDATE OR DELETE ON public.overtime_entries FOR EACH ROW EXECUTE FUNCTION public.sync_attendance_ot_change();
REVOKE ALL ON FUNCTION public.sync_attendance_ot_change() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.sync_attendance_month(p_company uuid,p_month date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role IN ('super_admin','admin','office')) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501'; END IF;
 PERFORM public.sync_company_month(p_company,p_month,true);
END $$;
REVOKE ALL ON FUNCTION public.sync_attendance_month(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_attendance_month(uuid,date) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.reset_module_data(modules text[],confirmation text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='super_admin') THEN RAISE EXCEPTION 'Only Super Admin can erase module data' USING ERRCODE='42501'; END IF;
 IF confirmation IS DISTINCT FROM 'DELETE' OR cardinality(modules) IS NULL OR cardinality(modules)=0 THEN RAISE EXCEPTION 'Select data and type DELETE'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(modules) m WHERE m NOT IN ('invoices','payments','salaries','attendance','overtime','cash_advances','food_advances','uniform_advances','food','inventory','maintenance','expenses','expense_categories','files','complaints','vendors','rates','companies','employees')) THEN RAISE EXCEPTION 'Unknown module'; END IF;
 IF 'payments'=ANY(modules) THEN DELETE FROM public.invoice_payments WHERE id IS NOT NULL; UPDATE public.invoices SET amount_received=0 WHERE id IS NOT NULL; END IF;
 IF 'invoices'=ANY(modules) THEN DELETE FROM public.invoice_payments WHERE id IS NOT NULL; DELETE FROM public.invoices WHERE id IS NOT NULL; END IF;
 IF 'salaries'=ANY(modules) THEN DELETE FROM public.salary_manual_deductions WHERE id IS NOT NULL; DELETE FROM public.salaries WHERE id IS NOT NULL; END IF;
 IF 'attendance'=ANY(modules) THEN DELETE FROM public.attendance WHERE id IS NOT NULL; END IF;
 IF 'overtime'=ANY(modules) THEN DELETE FROM public.overtime_entries WHERE id IS NOT NULL; END IF;
 IF 'cash_advances'=ANY(modules) THEN DELETE FROM public.cash_advances WHERE id IS NOT NULL; END IF;
 IF 'food_advances'=ANY(modules) THEN DELETE FROM public.food_advances WHERE id IS NOT NULL; END IF;
 IF 'uniform_advances'=ANY(modules) THEN DELETE FROM public.uniform_advances WHERE id IS NOT NULL; END IF;
 IF 'food'=ANY(modules) THEN DELETE FROM public.food_charges WHERE id IS NOT NULL; DELETE FROM public.food_rates WHERE id IS NOT NULL; DELETE FROM public.food_vendors WHERE id IS NOT NULL; END IF;
 IF 'inventory'=ANY(modules) THEN DELETE FROM public.inventory_movements WHERE id IS NOT NULL; DELETE FROM public.inventory_purchases WHERE id IS NOT NULL; DELETE FROM public.uniform_batches WHERE id IS NOT NULL; DELETE FROM public.inventory_items WHERE id IS NOT NULL; DELETE FROM public.assets WHERE id IS NOT NULL; END IF;
 IF 'maintenance'=ANY(modules) THEN DELETE FROM public.maintenance_records WHERE id IS NOT NULL; END IF;
 IF 'expenses'=ANY(modules) THEN DELETE FROM public.expenses WHERE id IS NOT NULL; END IF;
 IF 'expense_categories'=ANY(modules) THEN DELETE FROM public.expense_categories WHERE id IS NOT NULL; END IF;
 IF 'files'=ANY(modules) THEN DELETE FROM public.documents WHERE id IS NOT NULL; END IF;
 IF 'complaints'=ANY(modules) THEN DELETE FROM public.complaint_updates WHERE id IS NOT NULL; DELETE FROM public.employee_complaints WHERE id IS NOT NULL; END IF;
 IF 'vendors'=ANY(modules) THEN DELETE FROM public.vendors WHERE id IS NOT NULL; END IF;
 IF 'rates'=ANY(modules) THEN DELETE FROM public.employee_rate_overrides WHERE id IS NOT NULL; DELETE FROM public.company_rate_history WHERE id IS NOT NULL; END IF;
 IF 'companies'=ANY(modules) THEN DELETE FROM public.companies WHERE id IS NOT NULL; END IF;
 IF 'employees'=ANY(modules) THEN DELETE FROM public.employees WHERE id IS NOT NULL; END IF;
END $$;
REVOKE ALL ON FUNCTION public.reset_module_data(text[],text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reset_module_data(text[],text) TO authenticated,service_role;