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

interface ProductTypeSelectProps {
  onSelect: (value: string | null) => void;
  value: string | null;
  placeholder?: string;
  className?: string;
}

export function ProductTypeSelect({ 
  onSelect, 
  value, 
  placeholder = "Select product type...",
  className
}: ProductTypeSelectProps) {
  const [open, setOpen] = useState(false);

  const { data: productTypes = [], isLoading } = useQuery<string[]>({
    queryKey: ["/api/products/product-types"],
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // refetch every minute
  });

  // Reset value if it's not in the product types list
  useEffect(() => {
    if (productTypes.length > 0 && value && !productTypes.includes(value)) {
      onSelect(null);
    }
  }, [productTypes, value, onSelect]);

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
          <CommandInput placeholder="Search product types..." />
          <CommandEmpty>No product type found.</CommandEmpty>
          <CommandGroup className="max-h-[300px] overflow-y-auto">
            {productTypes.map((productType: string) => (
              <CommandItem
                key={productType}
                value={productType}
                onSelect={() => {
                  onSelect(productType === value ? null : productType);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === productType ? "opacity-100" : "opacity-0"
                  )}
                />
                {productType}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}