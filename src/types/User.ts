// 📁 src/types/User.ts

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'founder' | 'admin' | 'editor' | 'copyeditor' | 'reporter' | 'intern';
  avatar?: string;
  bio?: string;
  preferredCategories?: string[];
  createdAt?: string;
  updatedAt?: string;
}
