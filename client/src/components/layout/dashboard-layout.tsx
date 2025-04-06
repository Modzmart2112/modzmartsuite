import { ReactNode } from "react";
import Navbar from "./navbar";
import { CsvUploadModal } from "@/modals/csv-upload-modal";
import { PriceDiscrepancyNotification } from "@/modals/price-discrepancy-notification";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-gray-100 p-4">
        {children}
      </main>
      
      {/* Global Modals */}
      <CsvUploadModal />
      <PriceDiscrepancyNotification />
    </div>
  );
}
