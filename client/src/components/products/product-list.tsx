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
import { Search, RefreshCw, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductFilter } from "@/components/product-filters";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Function to format price with commas - handles null/undefined values or issues with NaN
const formatPrice = (price: number | null | undefined): string => {
  if (price === null || price === undefined || isNaN(Number(price))) {
    return '0.00';
  }
  
  // Ensure the price is treated as a number
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  try {
    return numericPrice.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  } catch (error) {
    console.error('Error formatting price:', numericPrice, error);
    return '0.00';
  }
};

export function ProductList({ 
  selectable = false, 
  onProductSelect,
  selectedProductIds = []
}: { 
  selectable?: boolean, 
  onProductSelect?: (productIds: number[]) => void,
  selectedProductIds?: number[]
}) {
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
  // Initialize with empty array and sync with props in useEffect
  const [selected, setSelected] = useState<number[]>([]);
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
  
  // Update parent component when selection changes
  useEffect(() => {
    if (onProductSelect) {
      onProductSelect(selected);
    }
  }, [selected, onProductSelect]);

  // Sync with external selectedProductIds
  useEffect(() => {
    setSelected(selectedProductIds);
  }, [selectedProductIds]);
  
  // Handle filter changes
  const handleFilterChange = (newFilters: {
    vendor: string | null;
    productType: string | null;
  }) => {
    setFilters(newFilters);
  };
  
  // Check if there's an active Shopify sync operation
  const { data: syncStatus } = useQuery({
    queryKey: ['/api/scheduler/shopify-sync-progress'],
    queryFn: async () => {
      const res = await fetch('/api/scheduler/shopify-sync-progress');
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 2000, // Check every 2 seconds
  });
  
  // Track previous sync status to detect when a sync completes
  const [prevSyncStatus, setPrevSyncStatus] = useState<string | null>(null);
  const isShopifySyncInProgress = syncStatus?.status === 'in-progress';

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
      
      const jsonData = await res.json();
      
      // Add debug log to inspect the first product's data
      if (jsonData.products && jsonData.products.length > 0) {
        console.log('Product sample cost price check: ');
        console.log('\tFirst product SKU:', jsonData.products[0].sku);
        console.log('\tCost price:', jsonData.products[0].costPrice);
        console.log('\tCost price type:', typeof jsonData.products[0].costPrice);
        console.log('\tAll properties:', Object.keys(jsonData.products[0]).join(', '));
      }
      
      return jsonData;
    },
    refetchOnWindowFocus: true,
    // Use a short refresh interval during Shopify sync operations to keep cost prices updated in real-time
    refetchInterval: isShopifySyncInProgress ? 2000 : false,
  });
  
  // When sync status changes from 'in-progress' to 'complete', trigger a refetch
  useEffect(() => {
    if (prevSyncStatus === 'in-progress' && syncStatus?.status === 'complete') {
      console.log('Shopify sync completed - refreshing product data');
      refetch();
    }
    setPrevSyncStatus(syncStatus?.status || null);
  }, [syncStatus?.status, refetch]);

  // Handle search changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1); // Reset to first page when searching
  };

  // Handle product selection
  const handleProductSelect = (productId: number) => {
    if (selected.includes(productId)) {
      setSelected(selected.filter(id => id !== productId));
    } else {
      setSelected([...selected, productId]);
    }
  };

  const handleSelectAll = () => {
    if (products.length > 0) {
      if (selected.length === products.length) {
        // If all are selected, deselect all
        setSelected([]);
      } else {
        // Otherwise select all products on the current page
        setSelected(products.map((product: any) => product.id));
      }
    }
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
                  {selectable && selected.length > 0 && (
                    <span className="ml-2 font-medium text-primary">
                      {selected.length} selected
                    </span>
                  )}
                  {isShopifySyncInProgress && (
                    <span className="ml-2 text-blue-500 font-medium animate-pulse">
                      Receiving cost price data...
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
                {selectable && (
                  <TableHead className="w-[50px]">
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAll}
                      checked={products.length > 0 && selected.length === products.length}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </TableHead>
                )}
                <TableHead>SKU</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Shopify ID</TableHead>
                <TableHead>Retail Price</TableHead>
                <TableHead>Cost Price</TableHead>
                <TableHead>Supplier Price</TableHead>
                <TableHead>Margin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Skeleton loader - show a reasonable number of rows
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {selectable && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-52" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  </TableRow>
                ))
              ) : products.length > 0 ? (
                products.map((product: any) => {
                  // Calculate margin percentage if both retail and cost price are available
                  const margin = product.costPrice ? 
                    ((product.shopifyPrice - product.costPrice) / product.shopifyPrice * 100).toFixed(1) : 
                    null;
                  
                  return (
                    <TableRow 
                      key={product.id} 
                      className={selectable && selected.includes(product.id) ? "bg-primary/5" : ""}
                    >
                      {selectable && (
                        <TableCell>
                          <input 
                            type="checkbox" 
                            checked={selected.includes(product.id)}
                            onChange={() => handleProductSelect(product.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{product.sku}</TableCell>
                      <TableCell>{product.title}</TableCell>
                      <TableCell>
                        <span className="font-mono">{product.shopifyId}</span>
                      </TableCell>
                      <TableCell>${formatPrice(product.shopifyPrice)}</TableCell>
                      <TableCell>
                        {product.costPrice 
                          ? <span className="font-medium">${formatPrice(product.costPrice)}</span>
                          : <span className="text-gray-400">Not set</span>
                        }
                        {/* Debug display to check raw value */}
                        {(process.env.NODE_ENV === 'development' && product.costPrice) && (
                          <span className="block text-xs text-gray-400">Raw: {product.costPrice}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.supplierPrice 
                          ? `$${formatPrice(product.supplierPrice)}`
                          : <span className="text-gray-400">Not available</span>
                        }
                      </TableCell>
                      <TableCell>
                        {margin ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className={`font-medium ${
                                parseFloat(margin) < 10 ? "text-red-500" : 
                                parseFloat(margin) < 20 ? "text-amber-500" : 
                                "text-green-600"
                              }`}>
                                {margin}%
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm">
                                  <p>Profit: ${formatPrice(product.shopifyPrice - (product.costPrice || 0))}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Based on retail vs. cost price
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
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
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={selectable ? 10 : 9} className="text-center py-4">
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