import { useState, useEffect } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";

interface VendorSelectProps {
  onSelect: (value: string | null) => void;
  value: string | null;
  placeholder?: string;
  className?: string;
}

export function VendorSelect({ 
  onSelect, 
  value, 
  placeholder = "Select vendor...",
  className
}: VendorSelectProps) {
  const [open, setOpen] = useState(false);

  const { data: vendors = [], isLoading } = useQuery<string[]>({
    queryKey: ["/api/products/vendors"],
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // refetch every minute
  });

  // Reset value if it's not in the vendors list
  useEffect(() => {
    if (vendors.length > 0 && value && !vendors.includes(value)) {
      onSelect(null);
    }
  }, [vendors, value, onSelect]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={isLoading}
        >
          {value ? value : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full min-w-[250px] p-0">
        <Command>
          <CommandInput placeholder="Search vendors..." />
          <CommandEmpty>No vendor found.</CommandEmpty>
          <CommandGroup className="max-h-[300px] overflow-y-auto">
            {vendors.map((vendor: string) => (
              <CommandItem
                key={vendor}
                value={vendor}
                onSelect={() => {
                  onSelect(vendor === value ? null : vendor);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === vendor ? "opacity-100" : "opacity-0"
                  )}
                />
                {vendor}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}