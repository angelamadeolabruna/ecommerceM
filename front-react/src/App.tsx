import { AuthProvider } from '@/contexts/AuthContext.js';
import { CartProvider } from '@/contexts/CartContext.js';
import { RouterApp } from '@/router.js';

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <RouterApp />
      </CartProvider>
    </AuthProvider>
  );
}