import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Target, Calendar, Wallet, ArrowRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FullPageLoader } from '@/components/ui/FullPageLoader';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const magicLinkSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const signupSchema = z.object({
  fullName: z.string().trim().optional(),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
}).refine((values) => values.password === values.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type LoginValues = z.infer<typeof loginSchema>;
type MagicLinkValues = z.infer<typeof magicLinkSchema>;
type SignupValues = z.infer<typeof signupSchema>;

export default function Auth() {
  const { signIn, signInWithMagicLink, signUp, loading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'magic' | 'login' | 'signup'>('magic');

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const signupForm = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const magicLinkForm = useForm<MagicLinkValues>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: {
      email: '',
    },
  });

  const handleMagicLink = magicLinkForm.handleSubmit(async (values) => {
    const { error } = await signInWithMagicLink(values.email);

    if (error) {
      toast({
        title: 'Magic Link Failed',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Check your email',
      description: 'We sent you a secure sign-in link.',
    });
    magicLinkForm.reset();
  });

  const handleLogin = loginForm.handleSubmit(async (values) => {
    const { error } = await signIn(values.email, values.password);

    if (error) {
      toast({
        title: 'Login Failed',
        description: error.message === 'Invalid login credentials'
          ? 'Invalid email or password. Please try again.'
          : error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Welcome back!',
      description: 'Successfully logged in.',
    });
  });

  const handleSignup = signupForm.handleSubmit(async (values) => {
    const { error } = await signUp(values.email, values.password, values.fullName);

    if (error) {
      const message = error.message.includes('already registered')
        ? 'This email is already registered. Please login instead.'
        : error.message;
      toast({
        title: 'Signup Failed',
        description: message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Welcome!',
      description: 'Account created successfully.',
    });
    signupForm.reset();
    setActiveTab('login');
  });

  if (loading) {
    return <FullPageLoader label="Preparing sign in..." />;
  }

  const features = [
    { icon: Target, label: 'Habit Tracking' },
    { icon: Wallet, label: 'Expense Manager' },
    { icon: Calendar, label: 'Calendar & Plans' },
    { icon: Sparkles, label: 'Smart Reminders' },
  ];

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 gradient-primary p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">LifeSync</h1>
          </div>
          <p className="text-white/80 text-lg">Your personal life management companion</p>
        </div>

        <div className="relative z-10 space-y-8">
          <h2 className="text-4xl font-bold text-white leading-tight">
            Transform Your Life,
            <br />
            One Habit at a Time
          </h2>

          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div
                key={feature.label}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-3 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-white font-medium">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-white/60 text-sm">© 2026 LifeSync. Start your journey today.</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">LifeSync</h1>
            </div>
            <p className="text-muted-foreground">Your life management companion</p>
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'magic' | 'login' | 'signup')} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="magic" className="text-base">Email Link</TabsTrigger>
              <TabsTrigger value="login" className="text-base">Password</TabsTrigger>
              <TabsTrigger value="signup" className="text-base">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="magic">
              <Card className="border-0 shadow-lg">
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle className="text-2xl">Sign in by email</CardTitle>
                  <CardDescription>Get a secure magic link sent to your inbox</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleMagicLink} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="magic-email">Email</Label>
                      <Input id="magic-email" type="email" placeholder="you@example.com" className="h-11" {...magicLinkForm.register('email')} />
                      {magicLinkForm.formState.errors.email && <p className="text-sm text-destructive">{magicLinkForm.formState.errors.email.message}</p>}
                    </div>
                    <Button type="submit" className="w-full h-11 gradient-primary text-white font-medium" disabled={magicLinkForm.formState.isSubmitting}>
                      {magicLinkForm.formState.isSubmitting ? 'Sending link...' : <>Send Magic Link <ArrowRight className="ml-2 w-4 h-4" /></>}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="login">
              <Card className="border-0 shadow-lg">
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle className="text-2xl">Welcome back</CardTitle>
                  <CardDescription>Enter your credentials to access your account</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input id="login-email" type="email" placeholder="you@example.com" className="h-11" {...loginForm.register('email')} />
                      {loginForm.formState.errors.email && <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input id="login-password" type="password" placeholder="••••••••" className="h-11" {...loginForm.register('password')} />
                      {loginForm.formState.errors.password && <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>}
                    </div>
                    <Button type="submit" className="w-full h-11 gradient-primary text-white font-medium" disabled={loginForm.formState.isSubmitting}>
                      {loginForm.formState.isSubmitting ? 'Logging in...' : <>Login <ArrowRight className="ml-2 w-4 h-4" /></>}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="signup">
              <Card className="border-0 shadow-lg">
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle className="text-2xl">Create an account</CardTitle>
                  <CardDescription>Start your journey to a better you</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="full-name">Full Name</Label>
                      <Input id="full-name" type="text" placeholder="John Doe" className="h-11" {...signupForm.register('fullName')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email</Label>
                      <Input id="signup-email" type="email" placeholder="you@example.com" className="h-11" {...signupForm.register('email')} />
                      {signupForm.formState.errors.email && <p className="text-sm text-destructive">{signupForm.formState.errors.email.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <Input id="signup-password" type="password" placeholder="••••••••" className="h-11" {...signupForm.register('password')} />
                      {signupForm.formState.errors.password && <p className="text-sm text-destructive">{signupForm.formState.errors.password.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <Input id="confirm-password" type="password" placeholder="••••••••" className="h-11" {...signupForm.register('confirmPassword')} />
                      {signupForm.formState.errors.confirmPassword && <p className="text-sm text-destructive">{signupForm.formState.errors.confirmPassword.message}</p>}
                    </div>
                    <Button type="submit" className="w-full h-11 gradient-primary text-white font-medium" disabled={signupForm.formState.isSubmitting}>
                      {signupForm.formState.isSubmitting ? 'Creating account...' : <>Create Account <ArrowRight className="ml-2 w-4 h-4" /></>}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
