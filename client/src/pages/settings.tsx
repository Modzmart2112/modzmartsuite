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

  const [telegramInfo, setTelegramInfo] = useState<TelegramConnectionInfo>({
    telegramChatId: "",
  });

  const shopifyMutation = useMutation({
    mutationFn: async (data: ShopifyConnectionInfo) => {
      const res = await apiRequest("POST", "/api/shopify/connect", data);
      return res.json();
    },
    onSuccess: () => {
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
                      </div>
                    </div>
                    
                    <Button type="submit" disabled={shopifyMutation.isPending}>
                      {shopifyMutation.isPending ? "Connecting..." : "Connect Shopify"}
                    </Button>
                  </div>
                </form>
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
