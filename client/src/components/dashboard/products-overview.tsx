import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

export function ProductsOverview() {
  // Fetch dashboard stats from API
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/dashboard/stats'],
  });

  // Calculate percentage of active products
  const activePercentage = stats?.productCount 
    ? ((stats.activeProductCount / stats.productCount) * 100).toFixed(2)
    : "0.00";

  return (
    <Card className="shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          {/* Left side: Pie chart */}
          <div className="w-[280px] flex-shrink-0 flex items-center justify-center">
            <div className="relative w-[240px] h-[240px]">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {/* Blue circle */}
                <circle 
                  cx="50" 
                  cy="50" 
                  r="45" 
                  fill="none" 
                  stroke="#38BDF8" 
                  strokeWidth="10" 
                />
                
                {/* Gray segment - only shows the inactive portion */}
                <circle 
                  cx="50" 
                  cy="50" 
                  r="45" 
                  fill="none" 
                  stroke="#E5E7EB" 
                  strokeWidth="10" 
                  strokeDasharray={`${(100 - parseFloat(activePercentage)) * 2.83} ${parseFloat(activePercentage) * 2.83}`}
                  transform="rotate(180 50 50)" 
                />
                
                {/* Central white circle for content */}
                <circle 
                  cx="50" 
                  cy="50" 
                  r="40" 
                  fill="white" 
                />
              </svg>
              
              {/* Overlay text in center */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-bold text-gray-900">
                  {isLoading ? "..." : stats?.activeProductCount.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 font-medium">
                  {activePercentage}% Active
                </div>
                <div className="w-3/4 border-t border-gray-200 my-2"></div>
                <div className="text-2xl font-bold text-gray-900">
                  {isLoading ? "..." : stats?.offMarketCount || 0}
                </div>
                <div className="text-sm text-gray-500">
                  Off Market
                </div>
              </div>
            </div>
          </div>
          
          {/* Right side: Stats */}
          <div className="flex-1 pl-4 flex flex-col justify-center">
            <div className="flex items-baseline">
              <div className="text-5xl font-bold text-gray-900">
                {isLoading ? "..." : stats?.productCount.toLocaleString()}
              </div>
              <div className="text-2xl text-gray-600 ml-2">products</div>
            </div>
            
            <div className="text-lg text-gray-500 mt-3 mb-8">
              {isLoading ? "..." : `${stats?.newProductsCount || 0} new products will arrive on next Monday`}
            </div>
            
            <div className="flex items-center gap-8">
              <div className="flex items-center">
                <span className="w-4 h-4 bg-blue-400 rounded-full mr-2"></span>
                <span className="text-base text-gray-700">Active listing</span>
              </div>
              <div className="flex items-center">
                <span className="w-4 h-4 bg-gray-300 rounded-full mr-2"></span>
                <span className="text-base text-gray-700">Off market</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
