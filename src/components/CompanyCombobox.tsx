import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

export interface CompanyOption {
  id: string;
  company_name: string;
  location?: string | null;
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  companies: CompanyOption[];
  placeholder?: string;
  className?: string;
  showLocation?: boolean;
  id?: string;
}

export function CompanyCombobox({
  value, onChange, companies, placeholder = "Select a company",
  className, showLocation, id,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = companies.find((c) => c.id === value);

  return (
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
              ? selected.company_name + (showLocation && selected.location ? ` — ${selected.location}` : "")
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search companies..." />
          <CommandList>
            <CommandEmpty>No company found.</CommandEmpty>
            <CommandGroup>
              {companies.map((c) => {
                const label = c.company_name + (showLocation && c.location ? ` — ${c.location}` : "");
                return (
                  <CommandItem
                    key={c.id}
                    value={label}
                    onSelect={() => {
                      onChange(c.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
