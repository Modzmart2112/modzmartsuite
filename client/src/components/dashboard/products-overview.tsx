import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

export function ProductsOverview() {
  // Fetch dashboard stats from API with aggressive refetch settings
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    // Refetch every 5 seconds to keep data updated, especially after operations
    refetchInterval: 5000,
    // Add staleTime of 0 to always fetch fresh data
    staleTime: 0,
    // Enable automatic refetching when window regains focus
    refetchOnWindowFocus: true,
  });

  // Calculate percentage of active products
  const activePercentage = stats?.productCount 
    ? ((stats.activeProductCount / stats.productCount) * 100).toFixed(2)
    : "0.00";

  return (
    <div className="w-full">
      <Card className="shadow-md border border-gray-100 w-full">
        <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-slate-50 dark:from-blue-950/50 dark:to-slate-950/50 border-b">
          <div className="flex items-center">
            <CardTitle className="text-lg">Products Overview</CardTitle>
            <CardDescription className="ml-2">Summary of product listings and status</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-stretch gap-8">
            {/* Left side: Total count and status */}
            <div className="w-full md:w-1/2 flex flex-col">
              <div className="flex items-baseline mb-2">
                <span className="text-5xl font-bold text-gray-900">
                  {isLoading ? "..." : stats?.safeToLocaleString(productCount)}
                </span>
                <span className="text-2xl font-medium text-gray-700 ml-3 tracking-tight">
                  total products
                </span>
              </div>
              
              <div className="text-base text-gray-500 mt-1 mb-6">
                {isLoading ? "..." : `Last updated: ${new Date(stats?.lastUpdated || Date.now()).toLocaleString()}`}
              </div>
              
              {/* Progress bar instead of pie chart */}
              <div className="mt-4 space-y-5 mb-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <div className="text-sm font-medium text-gray-700 flex items-center">
                      <span className="w-3 h-3 bg-primary rounded-sm mr-2"></span>
                      <span>Active listings</span>
                    </div>
                    <div className="text-sm font-medium">
                      {isLoading ? "..." : stats?.safeToLocaleString(activeProductCount)} ({activePercentage}%)
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full" 
                      style={{width: `${activePercentage}%`}}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between mb-1">
                    <div className="text-sm font-medium text-gray-700 flex items-center">
                      <span className="w-3 h-3 bg-gray-400 rounded-sm mr-2"></span>
                      <span>Off market</span>
                    </div>
                    <div className="text-sm font-medium">
                      {isLoading ? "..." : (stats?.offMarketCount || 0).toLocaleString()} ({(100 - parseFloat(activePercentage)).toFixed(2)}%)
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gray-400 rounded-full" 
                      style={{width: `${100 - parseFloat(activePercentage)}%`}}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right side: Stats cards */}
            <div className="w-full md:w-1/2 grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4 flex flex-col justify-between">
                <div className="text-sm font-medium text-gray-500">With supplier URLs</div>
                <div className="mt-2 text-2xl font-bold text-gray-900">
                  {isLoading ? "..." : stats?.withSupplierUrlCount || 0}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Ready for price tracking
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-xl p-4 flex flex-col justify-between">
                <div className="text-sm font-medium text-blue-600">Price discrepancies</div>
                <div className="mt-2 text-2xl font-bold text-blue-700">
                  {isLoading ? "..." : stats?.priceDiscrepancyCount || 0}
                </div>
                <div className="mt-1 text-xs text-blue-500">
                  Prices need review
                </div>
              </div>
              
              <div className="bg-green-50 rounded-xl p-4 flex flex-col justify-between">
                <div className="text-sm font-medium text-green-600">Price checks</div>
                <div className="mt-2 text-2xl font-bold text-green-700">
                  {isLoading ? "..." : stats?.totalPriceChecks || 0}
                </div>
                <div className="mt-1 text-xs text-green-500">
                  Total successful checks
                </div>
              </div>
              
              <div className="bg-purple-50 rounded-xl p-4 flex flex-col justify-between">
                <div className="text-sm font-medium text-purple-600">Synced with Shopify</div>
                <div className="mt-2 text-2xl font-bold text-purple-700">
                  {isLoading ? "..." : stats?.activeProductCount || 0}
                </div>
                <div className="mt-1 text-xs text-purple-500">
                  Last sync: {isLoading ? "..." : stats?.lastShopifySync ? safeToLocaleString(new Date(stats.lastShopifySync)) : "Never"}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
