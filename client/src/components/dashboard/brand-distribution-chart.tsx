import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { PieChart, Pie, ResponsiveContainer, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { Product } from "@shared/schema"; // Import the Product type

// Interface for brand statistics
interface BrandStat {
  name: string;
  count: number;
  color: string;
}

// Format numbers with commas
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

export function BrandDistributionChart() {
  const [chartType, setChartType] = useState<'pie' | 'bar'>('bar');
  
  // Brand colors array
  const BRAND_COLORS = [
    "#3b82f6", // blue
    "#a855f7", // purple
    "#ec4899", // pink
    "#8b5cf6", // indigo
    "#f97316", // orange
    "#10b981", // green
    "#f43f5e", // rose
    "#0ea5e9", // sky
    "#14b8a6", // teal
    "#f59e0b", // amber
    "#84cc16", // lime
    "#6366f1", // violet
  ];
  
  // Get all products from API - note the specific response shape
  const { data, isLoading } = useQuery<{products: Product[]}>({
    queryKey: ['/api/products'],
  });
  
  // Safely extract the products array
  const products = data?.products || [];
  
  // Process data to get brand statistics
  const brandStats = products.reduce((stats: Record<string, number>, product: Product) => {
    // Use vendor as the brand name, or fallback to product type if vendor is missing
    const brand = product.vendor || product.productType || 'Unknown';
    
    if (!stats[brand]) {
      stats[brand] = 0;
    }
    
    stats[brand]++;
    return stats;
  }, {});
  
  // Convert to array format for the chart
  const chartData: BrandStat[] = Object.entries(brandStats)
    .map(([name, count], index) => ({
      name,
      count,
      color: BRAND_COLORS[index % BRAND_COLORS.length]
    }))
    .sort((a, b) => b.count - a.count) // Sort by count in descending order
    .slice(0, 10); // Only show top 10 brands
  
  // Calculate total products
  const totalProducts = chartData.reduce((sum, item) => sum + item.count, 0);
  
  return (
    <Card className="shadow-md">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold text-gray-800">Products by Brand</CardTitle>
            <CardDescription>Distribution of products across manufacturers</CardDescription>
          </div>
          
          <div className="flex items-center">
            <div className="flex border rounded-md overflow-hidden">
              <Button 
                variant={chartType === 'bar' ? 'default' : 'ghost'}
                className="h-8 px-3 rounded-none" 
                onClick={() => setChartType('bar')}
              >
                Bar
              </Button>
              <Button 
                variant={chartType === 'pie' ? 'default' : 'ghost'}
                className="h-8 px-3 rounded-none" 
                onClick={() => setChartType('pie')}
              >
                Pie
              </Button>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div>
            <div className="text-sm font-medium text-gray-500">Total Brands</div>
            <div className="text-2xl font-bold mt-1">{Object.keys(brandStats).length}</div>
          </div>
          
          <div>
            <div className="text-sm font-medium text-gray-500">Total Products</div>
            <div className="text-2xl font-bold mt-1">{formatNumber(totalProducts)}</div>
          </div>
          
          <div>
            <div className="text-sm font-medium text-gray-500">Top Brand</div>
            <div className="text-2xl font-bold mt-1">
              {chartData.length > 0 ? chartData[0].name : 'N/A'}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {chartData.length > 0 ? `${formatNumber(chartData[0].count)} products` : ''}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="h-[350px] mt-8">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'pie' ? (
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={130}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="name"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [`${formatNumber(value)} products`, 'Count']}
                  contentStyle={{ 
                    backgroundColor: '#000', 
                    color: '#fff',
                    borderRadius: '4px', 
                    border: 'none',
                    fontSize: '12px'
                  }}
                />
                <Legend 
                  layout="vertical" 
                  verticalAlign="middle" 
                  align="right"
                  wrapperStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            ) : (
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{
                  top: 10,
                  right: 30,
                  left: 20,
                  bottom: 10,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" tickFormatter={(value) => formatNumber(value)} />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={120}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: number) => [formatNumber(value), 'Products']}
                  contentStyle={{ 
                    backgroundColor: '#000', 
                    color: '#fff',
                    borderRadius: '4px', 
                    border: 'none',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="count" fill="#3b82f6">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <LabelList 
                    dataKey="count" 
                    position="insideRight" 
                    style={{ fill: 'white', fontSize: 12, fontWeight: 'bold' }}
                    formatter={(value: number) => formatNumber(value)}
                  />
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
        
        <div className="flex items-center justify-end mt-4">
          <div className="flex items-center text-xs text-gray-500">
            <Info size={14} className="mr-1" />
            Distribution based on product data from your catalog
          </div>
        </div>
      </CardContent>
    </Card>
  );
}