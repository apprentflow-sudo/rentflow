import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// Owner API — uses Supabase session JWT stored in localStorage
export const api = axios.create({ baseURL: BASE })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('owner_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('owner_token')
      window.location.href = '/admin'
    }
    return Promise.reject(err)
  }
)

// Tenant API — uses custom JWT stored in sessionStorage
export const tenantApi = axios.create({ baseURL: BASE })

tenantApi.interceptors.request.use(config => {
  const token = sessionStorage.getItem('tenant_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

tenantApi.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem('tenant_token')
      sessionStorage.removeItem('tenant_id')
      window.location.href = '/pay'
    }
    return Promise.reject(err)
  }
)
