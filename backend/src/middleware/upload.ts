import multer from 'multer'

const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export const uploadReceipt = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (RECEIPT_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Solo se aceptan archivos JPG, PNG, WEBP o PDF'))
    }
  }
})

export const uploadContract = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Solo se aceptan archivos PDF para contratos'))
    }
  }
})
