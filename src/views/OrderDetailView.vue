<template>
  <div class="page-container p-4">
    <div class="flex items-center mb-6">
      <button @click="$router.go(-1)" class="mr-2 p-2 rounded-full hover:bg-gray-100">
        <i class="ph ph-arrow-left text-xl"></i>
      </button>
      <h1 class="text-xl font-semibold">订单详情</h1>
    </div>
    
    <div class="bg-white rounded-xl shadow-sm p-4">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-medium">订单 #{{ $route.params.id }}</h2>
        <span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">已完成</span>
      </div>
      
      <div class="space-y-3">
        <div class="flex justify-between">
          <span class="text-gray-600">客户</span>
          <span class="font-medium">张三</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">日期</span>
          <span class="font-medium">2024-12-15</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">金额</span>
          <span class="font-medium">¥299.00</span>
        </div>
      </div>
      
      <div class="mt-6">
        <h3 class="font-medium mb-3">商品列表</h3>
        <div class="space-y-2">
          <div class="flex justify-between py-2 border-b border-gray-100">
            <span>商品 A</span>
            <span>¥99.00 × 1</span>
          </div>
          <div class="flex justify-between py-2 border-b border-gray-100">
            <span>商品 B</span>
            <span>¥200.00 × 1</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';

const route = useRoute();
</script>

<style scoped>
.page-container {
  height: calc(100vh - 60px);
  overflow-y: auto;
}
</style>