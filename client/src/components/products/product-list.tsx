import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductFilter } from "@/components/product-filters";

// Function to format price with commas
const formatPrice = (price: number): string => {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export function ProductList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<{
    vendor: string | null;
    productType: string | null;
  }>({
    vendor: null,
    productType: null,
  });
  const limit = 50; // Number of products per page
  
  // Debounce search query input to avoid too many requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);
  
  // Handle filter changes
  const handleFilterChange = (newFilters: {
    vendor: string | null;
    productType: string | null;
  }) => {
    setFilters(newFilters);
  };
  
  // Fetch products from API - includes search functionality and filters
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/products', page, limit, debouncedSearch, filters.vendor, filters.productType],
    queryFn: async () => {
      // Build URL with search parameter and filters if needed
      let url = `/api/products?limit=${limit}&offset=${(page - 1) * limit}`;
      
      if (debouncedSearch) {
        url += `&search=${encodeURIComponent(debouncedSearch)}`;
      }
      
      if (filters.vendor) {
        url += `&vendor=${encodeURIComponent(filters.vendor)}`;
      }
      
      if (filters.productType) {
        url += `&productType=${encodeURIComponent(filters.productType)}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
    refetchOnWindowFocus: true,
  });
  
  // Handle search changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1); // Reset to first page when searching
  };
  
  const products = data?.products || [];
  const totalPages = data?.total ? Math.ceil(data.total / limit) : 0;
  const totalProducts = data?.total || 0;
  
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="w-full text-left mb-4">
              <h2 className="text-2xl font-bold">Products</h2>
              {!isLoading && (
                <p className="text-gray-500 mt-1">
                  Total: {totalProducts} products
                  {(filters.vendor || filters.productType) && (
                    <span className="italic ml-1">
                      (filtered)
                    </span>
                  )}
                </p>
              )}
            </div>
            
            {/* Filter controls at top */}
            <div className="w-full mb-4">
              <ProductFilter onFilterChange={handleFilterChange} />
            </div>
            
            <div className="flex items-center w-full max-w-3xl mx-auto">
              <div className="relative flex-1 mr-2">
                <Input
                  placeholder="Search products by SKU or title across all pages..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-10 h-12"
                />
                <Search className="absolute left-3 top-4 h-4 w-4 text-gray-400" />
              </div>
              
              <Button 
                variant="outline" 
                onClick={() => {
                  refetch();
                }}
                className="flex items-center gap-1 h-12 px-4"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Shopify Price</TableHead>
                <TableHead>Supplier Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Skeleton loader - show a reasonable number of rows
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-52" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  </TableRow>
                ))
              ) : products.length > 0 ? (
                products.map((product: any) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.sku}</TableCell>
                    <TableCell>{product.title}</TableCell>
                    <TableCell>${formatPrice(product.shopifyPrice)}</TableCell>
                    <TableCell>
                      {product.supplierPrice 
                        ? `$${formatPrice(product.supplierPrice)}`
                        : <span className="text-gray-400">Not available</span>
                      }
                    </TableCell>
                    <TableCell>
                      {product.hasPriceDiscrepancy ? (
                        <Badge variant="destructive">Price Discrepancy</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-100 text-green-800">
                          Synced
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {product.updatedAt 
                        ? new Date(product.updatedAt).toLocaleString()
                        : '-'
                      }
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4">
                    No products found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          
          {totalPages > 1 && (
            <div className="mt-4 flex justify-end">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    Page {page} of {totalPages}
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}