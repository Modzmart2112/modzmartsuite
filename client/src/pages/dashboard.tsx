import { PriceDiscrepancyChart } from "@/components/dashboard/price-discrepancy-chart";
import { PriceDiscrepancyList } from "@/components/dashboard/price-discrepancies-list";
import { ProductsOverview } from "@/components/dashboard/products-overview";
import { StatsRow } from "@/components/dashboard/stats-row";
import { SchedulerStatus } from "@/components/dashboard/scheduler-status";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Upload, PlusCircle } from "lucide-react";

export default function Dashboard() {
  const handleOpenUploadModal = () => {
    document.dispatchEvent(new CustomEvent('open-csv-upload-modal'));
  };

  return (
    <div className="container mx-auto">
      {/* Header Section with Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 md:mb-0">Dashboard</h1>
        
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            onClick={handleOpenUploadModal}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            <span>Upload Supplier Data</span>
          </Button>

          <Link href="/suppliers">
            <Button className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              <span>Manage Suppliers</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <StatsRow />

      {/* Price Discrepancy Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <PriceDiscrepancyChart />
        <ProductsOverview />
      </div>
      
      {/* Price Discrepancy List */}
      <div className="mb-6">
        <PriceDiscrepancyList />
      </div>
      
      {/* Bottom Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SchedulerStatus />
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">CSV uploaded: processed_APR Performance BAI 6.csv</p>
                  <p className="text-xs text-gray-500">58 products updated • Today at 7:18 AM</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">Price check completed</p>
                  <p className="text-xs text-gray-500">558 products checked, 319 updated • Today at 7:24 AM</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
