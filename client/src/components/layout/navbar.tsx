import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Users, 
  Search,
  HelpCircle, 
  Settings, 
  Bell
} from "lucide-react";

export default function Navbar() {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  
  const navItems = [
    { path: "/", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5 mr-2" /> },
    { path: "/products", label: "Products", icon: <ShoppingBag className="h-5 w-5 mr-2" /> },
    { path: "/suppliers", label: "Suppliers", icon: <Users className="h-5 w-5 mr-2" /> },
    { path: "/settings", label: "Settings", icon: <Settings className="h-5 w-5 mr-2" /> },
  ];

  return (
    <header>
      {/* Top navigation bar */}
      <div className="bg-primary text-white">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1 mr-6">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0">
              <img 
                src="/logo.png" 
                alt="MODZ MART" 
                className="h-10" 
              />
            </div>
            
            {/* Search */}
            <div className="relative hidden md:block flex-1 ml-6">
              <Input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-700 bg-opacity-50 rounded-full py-2 px-4 pl-10 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
            </div>
          </div>
          
          {/* Right Side Icons */}
          <div className="flex items-center space-x-4">
            <button className="text-gray-300 hover:text-white">
              <HelpCircle className="h-6 w-6" />
            </button>
            
            <button className="text-gray-300 hover:text-white">
              <Settings className="h-6 w-6" />
            </button>
            
            <button className="text-gray-300 hover:text-white relative">
              <Bell className="h-6 w-6" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">3</span>
            </button>
            
            {/* User Menu */}
            <div className="flex items-center">
              <button className="flex items-center">
                <Avatar>
                  <AvatarImage src="https://github.com/shadcn.png" alt="User" />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
                <span className="ml-2 hidden md:block">John Doe</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-primary/90 border-t border-gray-700">
        <div className="container mx-auto px-4">
          <nav className="flex overflow-x-auto no-scrollbar">
            {navItems.map((item, index) => (
              <div key={item.path} className="relative flex items-center">
                {index > 0 && (
                  <div className="absolute h-8 w-px bg-white/25 left-0 top-1/2 -translate-y-1/2"></div>
                )}
                <Link 
                  href={item.path}
                  className={`flex items-center px-6 py-4 text-white font-medium relative ${
                    location === item.path 
                      ? "after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-0 after:border-l-[6px] after:border-r-[6px] after:border-b-[6px] after:border-l-transparent after:border-r-transparent after:border-b-white" 
                      : "opacity-80 hover:opacity-100"
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </div>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
