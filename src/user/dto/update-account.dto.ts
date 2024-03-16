export class UpdateAccountDto {
  exchange_id?: number;
  apiKey?: string;
  secret?: string;
  exchange?: object;
  exchangeClass?: object;
  error_code?: number;
  is_connected?: boolean;
}
