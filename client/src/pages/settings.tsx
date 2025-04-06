import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ShopifyConnectionInfo, TelegramConnectionInfo } from "@shared/types";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Settings() {
  const { toast } = useToast();
  const [shopifyInfo, setShopifyInfo] = useState<ShopifyConnectionInfo>({
    shopifyApiKey: "",
    shopifyApiSecret: "",
    shopifyStoreUrl: "",
  });
  
  const [isConnected, setIsConnected] = useState<boolean>(false);

  const [telegramInfo, setTelegramInfo] = useState<TelegramConnectionInfo>({
    telegramChatId: "",
  });

  const shopifyMutation = useMutation({
    mutationFn: async (data: ShopifyConnectionInfo) => {
      const res = await apiRequest("POST", "/api/shopify/connect", data);
      return res.json();
    },
    onSuccess: () => {
      setIsConnected(true);
      toast({
        title: "Shopify Connected",
        description: "Your Shopify store has been successfully connected.",
      });
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Shopify.",
        variant: "destructive",
      });
    },
  });
  
  const syncProductsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/shopify/sync");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sync Started",
        description: "Products are being synced from your Shopify store. This may take a few minutes.",
      });
    },
    onError: (error) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync products from Shopify.",
        variant: "destructive",
      });
    },
  });

  const telegramMutation = useMutation({
    mutationFn: async (data: TelegramConnectionInfo) => {
      const res = await apiRequest("POST", "/api/telegram/connect", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Telegram Connected",
        description: "Your Telegram notifications have been successfully set up.",
      });
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Telegram.",
        variant: "destructive",
      });
    },
  });

  const handleShopifyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setShopifyInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleTelegramChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTelegramInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleShopifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    shopifyMutation.mutate(shopifyInfo);
  };

  const handleTelegramSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    telegramMutation.mutate(telegramInfo);
  };
  
  const handleSyncProducts = () => {
    syncProductsMutation.mutate();
  };

  return (
    <div className="container mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 md:mb-0">Settings</h1>
      </div>

      <Tabs defaultValue="integrations">
        <TabsList className="mb-6">
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>
        
        <TabsContent value="integrations">
          <div className="grid grid-cols-1 gap-6">
            {/* Shopify Integration */}
            <Card>
              <CardHeader>
                <CardTitle>Shopify Integration</CardTitle>
                <CardDescription>
                  Connect your Shopify store to sync products and monitor prices.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6 p-4 bg-blue-50 rounded-md border border-blue-100">
                  <h4 className="font-medium text-blue-700 mb-2">How to get your Shopify credentials</h4>
                  <ol className="space-y-2 text-sm text-blue-700">
                    <li>1. Log in to your Shopify admin panel</li>
                    <li>2. Go to Apps &gt; App and sales channel settings</li>
                    <li>3. Click "Develop apps for your store" and follow the prompts</li>
                    <li>4. Create a new app and name it "PriceSync"</li>
                    <li>5. Go to API credentials and create Admin API access token</li>
                    <li>6. Copy the API Key and API Secret</li>
                  </ol>
                </div>
                <form onSubmit={handleShopifySubmit}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="shopifyStoreUrl">Store URL</Label>
                        <Input
                          id="shopifyStoreUrl"
                          name="shopifyStoreUrl"
                          placeholder="your-store.myshopify.com"
                          value={shopifyInfo.shopifyStoreUrl}
                          onChange={handleShopifyChange}
                          required
                        />
                        <p className="text-xs text-gray-500">Example: mystore.myshopify.com (without https://)</p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="shopifyApiKey">API Key</Label>
                        <Input
                          id="shopifyApiKey"
                          name="shopifyApiKey"
                          placeholder="Your Shopify API Key"
                          value={shopifyInfo.shopifyApiKey}
                          onChange={handleShopifyChange}
                          required
                        />
                        <p className="text-xs text-gray-500">Example: 7d5f36d57d5f36d57d5f36d57d5f36d5</p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="shopifyApiSecret">API Secret</Label>
                        <Input
                          id="shopifyApiSecret"
                          name="shopifyApiSecret"
                          type="password"
                          placeholder="Your Shopify API Secret"
                          value={shopifyInfo.shopifyApiSecret}
                          onChange={handleShopifyChange}
                          required
                        />
                        <p className="text-xs text-gray-500">Example: shpss_a123456789abcdef123456789abcdef</p>
                      </div>
                    </div>
                    
                    <Button type="submit" disabled={shopifyMutation.isPending}>
                      {shopifyMutation.isPending ? "Connecting..." : "Connect Shopify"}
                    </Button>
                  </div>
                </form>
                
                {isConnected && (
                  <div className="mt-6 border-t pt-6">
                    <h3 className="text-lg font-medium mb-3">Manage Products</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Sync your Shopify products to monitor prices and track discrepancies.
                    </p>
                    <Button 
                      onClick={handleSyncProducts} 
                      disabled={syncProductsMutation.isPending}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      {syncProductsMutation.isPending ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Syncing Products...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                            <path d="M3 3v5h5" />
                            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                            <path d="M16 21h5v-5" />
                          </svg>
                          Sync Products from Shopify
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Telegram Notifications */}
            <Card>
              <CardHeader>
                <CardTitle>Telegram Notifications</CardTitle>
                <CardDescription>
                  Set up Telegram notifications for price discrepancies.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTelegramSubmit}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="telegramChatId">Telegram Chat ID</Label>
                        <Input
                          id="telegramChatId"
                          name="telegramChatId"
                          placeholder="Your Telegram Chat ID"
                          value={telegramInfo.telegramChatId}
                          onChange={handleTelegramChange}
                          required
                        />
                        <p className="text-sm text-gray-500">
                          You can get your Chat ID by messaging @userinfobot on Telegram.
                        </p>
                      </div>
                    </div>
                    
                    <Button type="submit" disabled={telegramMutation.isPending}>
                      {telegramMutation.isPending ? "Connecting..." : "Set Up Notifications"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure how and when you receive price discrepancy notifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Notification preferences will be available soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account details and password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                Account settings will be available soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
