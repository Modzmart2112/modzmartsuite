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
  Area
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
                    <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5E30AB" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#5E30AB" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#38BDF8" stopOpacity={0}/>
                    </linearGradient>
                    <filter id="purpleShadow" height="200%">
                      <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#5E30AB" floodOpacity="0.2"/>
                    </filter>
                    <filter id="blueShadow" height="200%">
                      <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#38BDF8" floodOpacity="0.2"/>
                    </filter>
                  </defs>
                  
                  {/* Fill areas under the lines */}
                  <Area 
                    type="monotone"
                    dataKey="netSales"
                    stroke="#5E30AB"
                    strokeWidth={0}
                    fillOpacity={1}
                    fill="url(#colorPrimary)"
                  />
                  <Area 
                    type="monotone"
                    dataKey="cost"
                    stroke="#38BDF8"
                    strokeWidth={0}
                    fillOpacity={1}
                    fill="url(#colorBlue)"
                  />
                  
                  {/* Main lines with shadows */}
                  <Line 
                    type="monotone" 
                    dataKey="netSales" 
                    name="Supplier Price"
                    stroke="#5E30AB" 
                    strokeWidth={3}
                    filter="url(#purpleShadow)"
                    dot={{ r: 6, strokeWidth: 3, fill: "#fff", stroke: "#5E30AB" }}
                    activeDot={{ r: 8, strokeWidth: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cost" 
                    name="Shopify Price"
                    stroke="#38BDF8" 
                    strokeWidth={3}
                    filter="url(#blueShadow)"
                    dot={{ r: 6, strokeWidth: 3, fill: "#fff", stroke: "#38BDF8" }}
                    activeDot={{ r: 8, strokeWidth: 3 }}
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
