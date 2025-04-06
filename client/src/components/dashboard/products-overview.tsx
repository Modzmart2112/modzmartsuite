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
        <div className="flex">
          {/* Left side: Pie chart */}
          <div className="w-[230px] flex-shrink-0">
            <div className="relative w-[200px] h-[200px]">
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
                <div className="text-2xl font-bold text-gray-900">
                  {isLoading ? "..." : stats?.activeProductCount.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 font-medium">
                  {activePercentage}% Active
                </div>
                <div className="w-3/4 border-t border-gray-200 my-1"></div>
                <div className="text-xl font-bold text-gray-900">
                  {isLoading ? "..." : stats?.offMarketCount || 0}
                </div>
                <div className="text-sm text-gray-500">
                  Off Market
                </div>
              </div>
            </div>
          </div>
          
          {/* Right side: Stats */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-baseline">
              <div className="text-4xl font-bold text-gray-900">
                {isLoading ? "..." : stats?.productCount.toLocaleString()}
              </div>
              <div className="text-2xl text-gray-600 ml-2">products</div>
            </div>
            
            <div className="text-lg text-gray-500 mt-2 mb-6">
              {isLoading ? "..." : `${stats?.newProductsCount || 0} new products will arrive on next Monday`}
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center">
                <span className="w-3 h-3 bg-blue-400 rounded-full mr-2"></span>
                <span className="text-base text-gray-700">Active listing</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-gray-300 rounded-full mr-2"></span>
                <span className="text-base text-gray-700">Off market</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
