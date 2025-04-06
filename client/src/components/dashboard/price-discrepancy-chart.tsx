import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { PriceDiscrepancy } from "@shared/types";

export function PriceDiscrepancyChart() {
  // Fetch dashboard stats from API
  const { data: stats = { totalRevenue: 0 }, isLoading } = useQuery<{ totalRevenue: number }>({
    queryKey: ['/api/dashboard/stats'],
  });

  // Fetch price discrepancies data
  const { data: discrepancies = [], isLoading: isLoadingDiscrepancies } = useQuery<PriceDiscrepancy[]>({
    queryKey: ['/api/products/discrepancies'],
  });
  
  // Sample chart data - would come from API in real implementation
  const chartData = [
    { month: '1st', netSales: 140, cost: 160 },
    { month: '2nd', netSales: 120, cost: 150 },
    { month: '3rd', netSales: 100, cost: 140 },
    { month: '4th', netSales: 80, cost: 130 },
    { month: '5th', netSales: 75, cost: 125 },
    { month: '6th', netSales: 60, cost: 120 },
  ];

  return (
    <Card className="shadow-md">
      <CardContent className="p-0">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Price Discrepancies & Costs</h2>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <span className="w-3 h-3 bg-primary rounded-full mr-2"></span>
                <span className="text-xs text-gray-600">Supplier Price</span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-blue-400 rounded-full mr-2"></span>
                <span className="text-xs text-gray-600">Shopify Price</span>
              </div>
              <span className="text-sm text-gray-500 ml-4">Last 90 days</span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-12 gap-6 p-6">
          <div className="col-span-4">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Total Revenue</h3>
                <div className="text-3xl font-bold text-gray-900">
                  {isLoading ? '...' : `$${((stats as any).totalRevenue / 1000).toFixed(2)}K`}
                </div>
                <div className="flex items-center mt-1">
                  <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">
                    +19.2%
                  </Badge>
                  <span className="text-xs text-gray-500 ml-2">vs prev. 90 days</span>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Price Discrepancies</h3>
                <div className="text-3xl font-bold text-gray-900">
                  {discrepancies.length}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Products with price differences
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Avg. Difference</h3>
                <div className="text-3xl font-bold text-gray-900">
                  {discrepancies.length > 0 
                    ? `$${(discrepancies.reduce((sum: number, d: PriceDiscrepancy) => sum + Math.abs(d.difference), 0) / discrepancies.length).toFixed(2)}`
                    : '$0.00'
                  }
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-span-8">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: 10,
                    left: 10,
                    bottom: 10,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12 }} 
                    width={40}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`$${value}`, '']}
                    labelFormatter={(label) => `Month: ${label}`}
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: 'none', 
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                      padding: '10px'
                    }}
                  />
                  <defs>
                    <linearGradient id="gradient1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gradient2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#38BDF8" stopOpacity={0}/>
                    </linearGradient>
                    <filter id="shadow1" x="-2" y="-2" width="104%" height="104%">
                      <feOffset dx="0" dy="2" />
                      <feGaussianBlur stdDeviation="2" />
                      <feColorMatrix type="matrix" values="0 0 0 0 0.3 0 0 0 0 0.1 0 0 0 0 0.7 0 0 0 0.3 0" />
                    </filter>
                    <filter id="shadow2" x="-2" y="-2" width="104%" height="104%">
                      <feOffset dx="0" dy="2" />
                      <feGaussianBlur stdDeviation="2" />
                      <feColorMatrix type="matrix" values="0 0 0 0 0.2 0 0 0 0 0.5 0 0 0 0 0.9 0 0 0 0.3 0" />
                    </filter>
                  </defs>
                  
                  {/* Main lines */}
                  <Line 
                    type="monotone" 
                    dataKey="netSales" 
                    name="Supplier Price"
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    style={{ filter: 'url(#shadow-primary)' }}
                    dot={{ r: 4, strokeWidth: 3, fill: "#fff" }}
                    activeDot={{ r: 6, strokeWidth: 3 }}
                    connectNulls
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cost" 
                    name="Shopify Price"
                    stroke="#38BDF8" 
                    strokeWidth={3}
                    style={{ filter: 'url(#shadow-blue)' }}
                    dot={{ r: 4, strokeWidth: 3, fill: "#fff" }}
                    activeDot={{ r: 6, strokeWidth: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
