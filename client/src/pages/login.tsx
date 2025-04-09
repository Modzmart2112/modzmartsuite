import { useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { EyeIcon, EyeOffIcon, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/lib/authContext";

// Import background image directly
import backgroundImage from "@assets/MODZ.png";

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
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {/* Background Image with Full Bleed */}
      <div 
        className="absolute inset-0 z-0" 
        style={{ 
          backgroundImage: `url(${backgroundImage})`, 
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "brightness(0.8)" 
        }}
      />
      
      {/* Animated Gradient Overlay */}
      <div 
        className="absolute inset-0 z-10 bg-gradient-to-br from-black/70 via-black/50 to-transparent opacity-80" 
      />
      
      {/* Animated Tech Pattern */}
      <div 
        className="absolute inset-0 z-10 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(circle at 25px 25px, rgba(255, 255, 255, 0.2) 2px, transparent 0), radial-gradient(circle at 75px 75px, rgba(255, 255, 255, 0.2) 2px, transparent 0)",
          backgroundSize: "100px 100px"
        }} />
      </div>
      
      {/* Content Container */}
      <div className="relative z-20 flex h-full w-full items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Brand Logo/Name */}
          <div className="mb-8 text-center">
            <div className="text-xl font-medium tracking-wide text-gray-400">
              SHOPIFY SUITE
            </div>
            <div className="mt-2 text-xs font-light text-gray-500 tracking-widest">
              MANAGEMENT PLATFORM
            </div>
          </div>
          
          {/* Login Card */}
          <div 
            className="relative overflow-hidden rounded-2xl border border-gray-800 bg-black/40 backdrop-blur-lg shadow-2xl"
          >
            {/* Animated card border glow */}
            <div 
              className="absolute inset-0 rounded-2xl z-[-1]"
              style={{
                background: "linear-gradient(45deg, rgba(59, 130, 246, 0.3), rgba(147, 51, 234, 0.3))",
                filter: "blur(20px)",
                opacity: 0.7,
              }} 
            />
            
            <div className="px-6 py-8">
              <div className="mb-6 text-center">
                <h2 className="text-xl font-semibold text-white">Secure Login</h2>
                <p className="mt-1 text-sm text-gray-400">
                  Enter your credentials to access the dashboard
                </p>
              </div>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-gray-300 text-sm font-medium">Username</FormLabel>
                        <FormControl>
                          <div className="group relative">
                            <Input
                              {...field}
                              disabled={isLoading}
                              placeholder="Enter your username"
                              className="bg-black/50 border-gray-700/50 text-white pr-10 py-5 pl-4 rounded-xl focus-visible:ring-blue-600/50 focus-visible:border-blue-500/50 group-hover:border-gray-600/80 transition-all duration-200"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                              <User className="h-5 w-5" />
                            </div>
                          </div>
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
                        <FormLabel className="text-gray-300 text-sm font-medium">Password</FormLabel>
                        <FormControl>
                          <div className="group relative">
                            <Input
                              {...field}
                              type={showPassword ? "text" : "password"}
                              disabled={isLoading}
                              placeholder="Enter your password"
                              className="bg-black/50 border-gray-700/50 text-white pr-10 py-5 pl-4 rounded-xl focus-visible:ring-blue-600/50 focus-visible:border-blue-500/50 group-hover:border-gray-600/80 transition-all duration-200"
                            />
                            <button
                              type="button"
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
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
                    className="w-full mt-2 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white py-5 rounded-xl transition-all duration-200 shadow-lg shadow-blue-900/20 hover:shadow-blue-800/30"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Authenticating...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center">
                        <span>Sign In</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2"><path d="M9 18l6-6-6-6"/></svg>
                      </div>
                    )}
                  </Button>
                </form>
              </Form>

              <div className="mt-6 text-center text-xs text-gray-500">
                <p>Use admin/admin for demo access</p>
              </div>
            </div>
            
            <div className="flex flex-col space-y-2 border-t border-gray-800/50 bg-black/30 pt-4 pb-4 px-6">
              <div className="flex items-center justify-center">
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-xs text-gray-400">Secure connection</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>© {new Date().getFullYear()} MODZ MART PTY LTD</span>
                <span>v2.0.25</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Animated floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(10)].map((_, i) => (
          <div 
            key={i} 
            className="absolute rounded-full animate-pulse"
            style={{
              width: `${Math.random() * 5 + 2}px`,
              height: `${Math.random() * 5 + 2}px`,
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDuration: `${Math.random() * 5 + 3}s`,
              opacity: Math.random() * 0.7 + 0.3
            }}
          />
        ))}
      </div>

      {/* Tech grid lines effect */}
      <div className="absolute inset-0 z-10 opacity-10 pointer-events-none">
        <div className="h-full w-full" style={{
          backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(255, 255, 255, 0.05) 25%, rgba(255, 255, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, 0.05) 75%, rgba(255, 255, 255, 0.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255, 255, 255, 0.05) 25%, rgba(255, 255, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, 0.05) 75%, rgba(255, 255, 255, 0.05) 76%, transparent 77%, transparent)',
          backgroundSize: '80px 80px'
        }} />
      </div>
    </div>
  );
}