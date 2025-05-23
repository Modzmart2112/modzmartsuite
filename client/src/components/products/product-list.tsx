import { useState, useEffect, useRef } from "react";
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
  
  // Get the current sync status and trigger a refetch when it completes
  const isShopifySyncInProgress = syncStatus?.status === 'in-progress';
  const prevSyncStatusRef = useRef<string | null>(null);
  
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
  
  // Tracks whether we need to force a refresh after a sync
  const [forcedRefreshKey, setForcedRefreshKey] = useState(0);
  const forcedRefreshTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Track if we should refresh cost prices
  const [shouldRefreshCostPrices, setShouldRefreshCostPrices] = useState(false);
  
  // Effect to handle cost price refreshes - runs only when shouldRefreshCostPrices changes to true
  useEffect(() => {
    // Only run the effect when shouldRefreshCostPrices is true
    // This prevents infinite loops by only running when it transitions to true
    if (shouldRefreshCostPrices) {
      console.log('Triggering dedicated cost price refresh endpoint');
      
      // Use a local variable to track the current request
      // This ensures we don't have race conditions with multiple requests
      const isCurrentRequest = true;
      
      fetch('/api/products/refresh-cost-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(res => res.json())
      .then(data => {
        console.log('Cost price refresh complete:', data);
        
        // Only update state if this is still the current request
        if (isCurrentRequest) {
          // First set the flag to false before triggering a refetch
          setShouldRefreshCostPrices(false);
          
          // Use setTimeout to ensure state update completes before refetch
          setTimeout(() => {
            // Force a refetch with the updated cost prices
            refetch();
          }, 50);
        }
      })
      .catch(error => {
        console.error('Error refreshing cost prices:', error);
        // Only update state if this is still the current request
        if (isCurrentRequest) {
          setShouldRefreshCostPrices(false);
        }
      });
    }
  }, [shouldRefreshCostPrices]); // Remove refetch from dependencies to avoid infinite loops

  // When sync status changes from 'in-progress' to 'complete', trigger a refetch
  // This useEffect is designed to avoid infinite rerenders by carefully managing dependencies
  useEffect(() => {
    // Only run this effect if we have a valid syncStatus and it's not the initial render
    if (syncStatus && prevSyncStatusRef.current !== null) {
      const currentStatus = syncStatus.status;
      const prevStatus = prevSyncStatusRef.current;
      
      // If status changed and transition from in-progress to complete
      if (prevStatus !== currentStatus && prevStatus === 'in-progress' && currentStatus === 'complete') {
        console.log('Shopify sync completed - using more robust refresh strategy');
        
        // Cleanup any existing refresh timeouts
        if (forcedRefreshTimeout.current) {
          clearTimeout(forcedRefreshTimeout.current);
        }
        
        // Use a staged approach with appropriate delays to avoid race conditions
        // and ensure proper state updates
        
        // Stage 1: Call our general refresh endpoint to break any rendering loops
        // The server-side refresh API is designed to just return a success message
        // without actually doing any database queries - it simply tells the client
        // to refresh its data
        console.log('Stage 1: Initiating general refresh signal');
        
        fetch('/api/products/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        .then(res => res.json())
        .then(data => {
          console.log('General refresh signal received:', data);
          
          // Stage 2: Wait a brief moment, then trigger the forced refetch 
          // This uses a key change to force a full remount/refresh
          forcedRefreshTimeout.current = setTimeout(() => {
            console.log('Stage 2: Forcing component refresh');
            setForcedRefreshKey(prevKey => prevKey + 1);
            
            // Stage 3: After the forced refresh, wait briefly and then refresh cost prices
            // The delay ensures stages are separated and don't overlap
            setTimeout(() => {
              console.log('Stage 3: Initiating cost price refresh');
              // This will trigger our other useEffect which handles the refresh-cost-prices endpoint
              setShouldRefreshCostPrices(true);
            }, 300);
          }, 300);
        })
        .catch(err => {
          console.error('Error sending refresh signal:', err);
          // Still try our cost price refresh as a fallback, but with a delay
          setTimeout(() => {
            console.log('Fallback: Triggering cost price refresh directly');
            setShouldRefreshCostPrices(true);
          }, 300);
        });
      }
      
      // Always update the ref with the new status
      prevSyncStatusRef.current = currentStatus;
    } else if (syncStatus && prevSyncStatusRef.current === null) {
      // First time we get sync status, just set the ref
      prevSyncStatusRef.current = syncStatus.status;
    }
  }, [syncStatus?.status]); // Only depend on the status property of syncStatus

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
            
            <div className="flex items-center w-full mx-auto mb-4">
              <div className="relative flex-1 mr-3">
                <Input
                  placeholder="Search products by SKU or title across all pages..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-10 h-12 text-base shadow-sm border-2 focus-visible:ring-2 focus-visible:ring-offset-1"
                />
                <Search className="absolute left-3 top-4 h-5 w-5 text-gray-500" />
              </div>
              
              <Button 
                variant="outline" 
                onClick={() => {
                  refetch();
                }}
                className="flex items-center gap-2 h-12 px-5 font-medium shadow-sm border-2"
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
                          ? safeToLocaleString(new Date(product.updatedAt))
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