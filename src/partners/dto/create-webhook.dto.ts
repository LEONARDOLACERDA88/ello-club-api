import { IsString, IsUrl, IsArray, ArrayNotEmpty } from 'class-validator'

export class CreateWebhookDto {
  @IsUrl()
  url: string

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  events: string[] // ['redemption.created', 'offer.expired']
}
