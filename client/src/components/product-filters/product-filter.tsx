import { useState } from "react";
import { VendorSelect } from "./vendor-select";
import { ProductTypeSelect } from "./product-type-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";

interface ProductFilterProps {
  onFilterChange: (filters: {
    vendor: string | null;
    productType: string | null;
  }) => void;
  className?: string;
}

export function ProductFilter({ onFilterChange, className }: ProductFilterProps) {
  const [vendor, setVendor] = useState<string | null>(null);
  const [productType, setProductType] = useState<string | null>(null);

  const handleVendorChange = (value: string | null) => {
    setVendor(value);
    onFilterChange({
      vendor: value,
      productType,
    });
  };

  const handleProductTypeChange = (value: string | null) => {
    setProductType(value);
    onFilterChange({
      vendor,
      productType: value,
    });
  };

  const clearFilters = () => {
    setVendor(null);
    setProductType(null);
    onFilterChange({
      vendor: null,
      productType: null,
    });
  };

  const hasActiveFilters = vendor !== null || productType !== null;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center justify-between">
          Filter Products
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 px-2 text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="vendor-select">
            Vendor
          </label>
          <VendorSelect
            value={vendor}
            onSelect={handleVendorChange}
            placeholder="All vendors"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="product-type-select">
            Product Type
          </label>
          <ProductTypeSelect
            value={productType}
            onSelect={handleProductTypeChange}
            placeholder="All product types"
          />
        </div>
      </CardContent>
    </Card>
  );
}