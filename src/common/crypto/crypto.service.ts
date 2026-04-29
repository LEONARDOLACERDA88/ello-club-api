import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-cbc'
  private readonly key: Buffer

  constructor(private config: ConfigService) {
    const secret = config.get<string>('ENCRYPTION_KEY')
    if (!secret || secret.length < 32) {
      throw new Error('ENCRYPTION_KEY deve ter no mínimo 32 caracteres')
    }
    this.key = Buffer.from(secret.slice(0, 32))
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv)
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`
  }

  decrypt(encrypted: string): string {
    const [ivHex, encryptedHex] = encrypted.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const encryptedBuffer = Buffer.from(encryptedHex, 'hex')
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv)
    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]).toString('utf8')
  }

  hashSha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex')
  }

  generateApiKey(): string {
    return `ello_pk_${crypto.randomBytes(32).toString('hex')}`
  }
}
