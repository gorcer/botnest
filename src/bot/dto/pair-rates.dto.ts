export class PairRatesDto {
    [pairName:string]:{
        bid:number,
        ask:number
    }
}