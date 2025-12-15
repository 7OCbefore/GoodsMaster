<template>
  <div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
        商品管理系统
      </h2>
      <p class="mt-2 text-center text-sm text-gray-600">
        登录以同步您的数据
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <form class="space-y-6" @submit.prevent="handleLogin">
          <div>
            <label for="email" class="block text-sm font-medium text-gray-700">
              邮箱地址
            </label>
            <div class="mt-1">
              <input
                id="email"
                name="email"
                type="email"
                autocomplete="email"
                v-model="email"
                required
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">
              密码
            </label>
            <div class="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                autocomplete="current-password"
                v-model="password"
                required
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          <div class="flex items-center justify-between">
            <div class="text-sm">
              <a href="#" @click="handleSignUp" class="font-medium text-indigo-600 hover:text-indigo-500">
                还没有账户？立即注册
              </a>
            </div>
          </div>

          <div>
            <button
              type="submit"
              :disabled="loading"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <span v-if="!loading">登录</span>
              <span v-else>登录中...</span>
            </button>
          </div>
          
          <div v-if="error" class="text-red-500 text-sm text-center">
            {{ error }}
          </div>
        </form>
        
        <div class="mt-6">
          <div class="relative">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white text-gray-500">或者</span>
            </div>
          </div>

          <div class="mt-6 grid grid-cols-1 gap-3">
            <div>
              <button
                @click="handleGuestLogin"
                :disabled="loading"
                class="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                <span>以访客身份继续（无云同步）</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { supabase } from '../services/supabase';
import { syncService } from '../services/syncService';
import { useRouter } from 'vue-router';

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

const router = useRouter();

const handleLogin = async () => {
  if (!email.value || !password.value) {
    error.value = '请输入邮箱和密码';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    });

    if (authError) {
      error.value = authError.message;
      return;
    }

    // 登录成功后同步云端数据
    await syncService.sync();
    
    // 跳转到主应用
    router.push('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    error.value = '登录过程中发生错误，请重试';
  } finally {
    loading.value = false;
  }
};

const handleSignUp = async () => {
  if (!email.value || !password.value) {
    error.value = '请填写邮箱和密码';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const { error: authError } = await supabase.auth.signUp({
      email: email.value,
      password: password.value
    });

    if (authError) {
      error.value = authError.message;
      return;
    }

    // 注册成功后，提示用户检查邮箱
    error.value = '注册成功！请检查您的邮箱以确认账户';
  } catch (err) {
    console.error('Signup error:', err);
    error.value = '注册过程中发生错误，请重试';
  } finally {
    loading.value = false;
  }
};

const handleGuestLogin = async () => {
  loading.value = true;
  try {
    // 不进行身份验证，直接跳转到主应用
    router.push('/dashboard');
  } catch (err) {
    console.error('Guest login error:', err);
    error.value = '启动应用时发生错误';
  } finally {
    loading.value = false;
  }
};
</script>