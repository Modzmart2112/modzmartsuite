import { useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { EyeIcon, EyeOffIcon, LoaderCircle } from "lucide-react";
import { useAuth } from "@/lib/authContext";

// Form validation schema
const loginSchema = z.object({
  username: z.string().min(1, { message: "Username is required" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [_, setLocation] = useLocation();
  const { login } = useAuth();

  // Form definition
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Login form submission handler
  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);

    try {
      const success = await login(data.username, data.password);
      
      if (success) {
        toast({
          title: "Login successful",
          description: "Welcome to MODZ MART Shopify Suite",
        });
        setTimeout(() => setLocation("/"), 500); // Small delay for toast to show
      } else {
        toast({
          title: "Authentication failed",
          description: "Invalid username or password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Authentication failed",
        description: "An error occurred during login",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <div 
        className="flex flex-1 flex-col items-center justify-center bg-cover bg-center p-4" 
        style={{ 
          backgroundImage: "url('/images/MODZ.png')", 
          backgroundSize: "cover",
          backgroundPosition: "center" 
        }}
      >
        {/* Overlay for better text visibility */}
        <div className="absolute inset-0 bg-black/30"></div>
        
        {/* Login Card */}
        <Card className="relative w-full max-w-md overflow-hidden rounded-xl bg-black/65 backdrop-blur-sm border-gray-800 shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-3xl font-bold tracking-tighter text-white">
              MODZ MART
            </CardTitle>
            <CardDescription className="text-gray-300">
              Enter your credentials to access the Shopify Suite
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Username</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={isLoading}
                          placeholder="Enter your username"
                          className="bg-black/40 text-white border-gray-700 focus-visible:ring-primary"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-300">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            disabled={isLoading}
                            placeholder="Enter your password"
                            className="bg-black/40 text-white border-gray-700 pr-10 focus-visible:ring-primary"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOffIcon className="h-5 w-5" />
                            ) : (
                              <EyeIcon className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  disabled={isLoading} 
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                >
                  {isLoading ? (
                    <>
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center text-xs text-gray-400">
              <p>Use admin/admin for demo access</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2 border-t border-gray-800 bg-black/50 pt-4">
            <div className="flex items-center justify-center text-sm text-gray-400">
              <span className="mr-1">MODZ MART PTY LTD © {new Date().getFullYear()}</span>
            </div>
            <div className="text-center text-xs text-gray-500">
              Shopify Suite v2.0.25
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}