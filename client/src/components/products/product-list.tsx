import { useState } from "react";
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
  const [isSearching, setIsSearching] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const limit = 50; // Changed from 10 to 50 products per page
  
  // Fetch products from API
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/products', page, limit],
    queryFn: async () => {
      const res = await fetch(`/api/products?limit=${limit}&offset=${(page - 1) * limit}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    }
  });
  
  // Fetch all products for search feature
  const { data: allProductsData, isLoading: isLoadingAllProducts, refetch: refetchAll } = useQuery({
    queryKey: ['/api/products', 'all'],
    queryFn: async () => {
      // Only fetch all products when searching
      if (!searchQuery) return { products: [] };
      
      setIsSearching(true);
      // Fetch with a high limit to get essentially all products
      const res = await fetch(`/api/products?limit=5000&offset=0`);
      if (!res.ok) throw new Error('Failed to fetch all products');
      const result = await res.json();
      setAllProducts(result.products);
      setIsSearching(false);
      return result;
    },
    enabled: searchQuery.length > 0, // Only run when there's a search query
  });
  
  // Handle search changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1); // Reset to first page when searching
  };
  
  // Filter products by search query
  const filteredProducts = searchQuery
    ? (allProducts.length > 0 ? allProducts : data?.products || []).filter((product: any) => 
        product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : data?.products || [];
  
  const displayedProducts = searchQuery ? filteredProducts.slice((page - 1) * limit, page * limit) : filteredProducts;
  const totalFilteredProducts = filteredProducts.length;
  const totalPages = searchQuery 
    ? Math.ceil(totalFilteredProducts / limit) 
    : (data?.total ? Math.ceil(data.total / limit) : 0);
  const totalProducts = searchQuery ? totalFilteredProducts : (data?.total || 0);
  
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col items-center mb-8">
          <div className="w-full text-left mb-4">
            <h2 className="text-2xl font-bold">Products</h2>
            {!isLoading && (
              <p className="text-gray-500 mt-1">
                Total: {totalProducts} products
              </p>
            )}
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
                if (searchQuery) refetchAll();
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
            {isLoading || isSearching ? (
              // Skeleton loader - increased to match new limit
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
            ) : displayedProducts.length > 0 ? (
              displayedProducts.map((product: any) => (
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
  );
}
