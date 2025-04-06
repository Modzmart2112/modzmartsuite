import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

export function ProductsOverview() {
  // Fetch dashboard stats from API
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/dashboard/stats'],
  });

  // Calculate percentage of active products
  const activePercentage = stats?.productCount 
    ? ((stats.activeProductCount / stats.productCount) * 100).toFixed(1)
    : "0.0";

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Products</h2>
        </div>
        
        <div className="flex items-start">
          <div className="mr-8">
            <div className="text-4xl font-bold text-gray-900">
              {isLoading ? "..." : stats?.productCount.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 mt-1">products</div>
            <div className="text-xs text-gray-500 mt-4">
              {isLoading ? "..." : `${stats?.newProductsCount || 0} new products will arrive on next Monday`}
            </div>
            
            <div className="flex items-center mt-4 space-x-4">
              <div className="flex items-center">
                <span className="w-3 h-3 bg-blue-400 rounded-full mr-1"></span>
                <span className="text-xs text-gray-500">Active listing</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-gray-300 rounded-full mr-1"></span>
                <span className="text-xs text-gray-500">Off market</span>
              </div>
            </div>
          </div>
          
          <div className="relative flex-shrink-0">
            <svg viewBox="0 0 200 200" width="140" height="140">
              {/* Background circle */}
              <circle cx="100" cy="100" r="80" fill="none" stroke="#E5E7EB" strokeWidth="20" />
              
              {/* Progress circle - dynamic based on active products percentage */}
              <circle 
                cx="100" 
                cy="100" 
                r="80" 
                fill="none" 
                stroke="#38BDF8" 
                strokeWidth="20" 
                strokeDasharray="502" 
                strokeDashoffset={502 - ((parseFloat(activePercentage) / 100) * 502)}
                transform="rotate(-90 100 100)" 
              />
              
              {/* Inner text values */}
              <text x="100" y="90" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#111827">
                {isLoading ? "..." : stats?.activeProductCount.toLocaleString()}
              </text>
              <text x="100" y="115" textAnchor="middle" fontSize="14" fill="#6B7280">
                {activePercentage}% Active
              </text>
            </svg>
            
            <div className="absolute bottom-0 right-0 bg-gray-100 rounded-full px-2 py-0.5 text-xs font-medium text-gray-700">
              {isLoading ? "..." : stats?.offMarketCount || 0}<br/>Off Market
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
