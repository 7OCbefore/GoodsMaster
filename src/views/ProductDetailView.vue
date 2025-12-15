<template>
  <div class="page-container p-4">
    <div class="flex items-center mb-6">
      <button @click="$router.go(-1)" class="mr-2 p-2 rounded-full hover:bg-gray-100">
        <i class="ph ph-arrow-left text-xl"></i>
      </button>
      <h1 class="text-xl font-semibold">商品详情</h1>
    </div>
    
    <div class="bg-white rounded-xl shadow-sm p-4">
      <div class="flex items-center mb-4">
        <div class="w-16 h-16 bg-gray-200 rounded-lg mr-4"></div>
        <div>
          <h2 class="text-lg font-medium">商品名称</h2>
          <p class="text-gray-600 text-sm">商品描述信息</p>
        </div>
      </div>
      
      <div class="space-y-3">
        <div class="flex justify-between">
          <span class="text-gray-600">商品编码</span>
          <span class="font-medium">SP001</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">分类</span>
          <span class="font-medium">食品</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">库存</span>
          <span class="font-medium">99</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-600">价格</span>
          <span class="font-medium text-primary">¥29.90</span>
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