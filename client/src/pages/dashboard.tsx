import { CsvUpload } from "@/components/dashboard/csv-upload";
import { PriceDiscrepancyChart } from "@/components/dashboard/price-discrepancy-chart";
import { ProductsOverview } from "@/components/dashboard/products-overview";
import { StatsRow } from "@/components/dashboard/stats-row";
import { SalesChannels } from "@/components/dashboard/sales-channels";
import { GeoDistribution } from "@/components/dashboard/geo-distribution";

export default function Dashboard() {
  return (
    <div className="container mx-auto">
      {/* Header Section with Date Selector */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 md:mb-0">Dashboard</h1>
        
        <div className="flex items-center space-x-4">
          <div className="relative">
            <button className="flex items-center bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary">
              <span>All Warehouses</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          <div className="relative">
            <button className="flex items-center bg-white border border-gray-300 rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary">
              <span>Last 90 days: Oct 19, 2022 - Dec 4, 2023</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* CSV Upload Section */}
      <CsvUpload />

      {/* Price Discrepancy Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <PriceDiscrepancyChart />
        <ProductsOverview />
      </div>

      {/* Stats Row */}
      <StatsRow />
      
      {/* Bottom Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <GeoDistribution />
        <SalesChannels />
      </div>
    </div>
  );
}
