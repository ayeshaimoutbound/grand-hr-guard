import { useState } from "react";
import { Check, ChevronsUpDown, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { QuickAddEmployeeDialog } from "@/components/QuickAddEmployeeDialog";

export interface EmployeeOption {
  id: string;
  employee_id: string;
  full_name: string;
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  employees: EmployeeOption[];
  placeholder?: string;
  className?: string;
  id?: string;
  /** Called after a new employee is created from the picker, so the list can refresh. */
  onEmployeeCreated?: (employee: EmployeeOption) => void;
  /** Set to false to hide the inline "Add new employee" action. */
  allowAdd?: boolean;
}

export function EmployeeCombobox({
  value, onChange, employees, placeholder = "Select an employee", className, id,
  onEmployeeCreated, allowAdd = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = employees.find((e) => e.id === value);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between font-normal", className)}
          >
            <span className="truncate">
              {selected
                ? `${selected.full_name}${selected.employee_id ? ` (${selected.employee_id})` : ""}`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search employees..." value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>
                <div className="py-3 text-sm text-muted-foreground">No employee found.</div>
              </CommandEmpty>
              <CommandGroup>
                {employees.map((e) => {
                  const label = `${e.full_name}${e.employee_id ? ` (${e.employee_id})` : ""}`;
                  return (
                    <CommandItem
                      key={e.id}
                      value={label}
                      onSelect={() => { onChange(e.id); setOpen(false); }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", value === e.id ? "opacity-100" : "opacity-0")} />
                      {label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {allowAdd && (
                <CommandGroup>
                  <CommandItem
                    value="__add_new_employee__"
                    onSelect={() => { setOpen(false); setAddOpen(true); }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add new employee
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {allowAdd && (
        <QuickAddEmployeeDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          defaultName={query}
          onCreated={(emp) => {
            onEmployeeCreated?.(emp);
            onChange(emp.id);
          }}
        />
      )}
    </>
  );
}

