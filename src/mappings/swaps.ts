import { log, BigInt, BigDecimal, Value, Bytes, Address } from '@graphprotocol/graph-ts'
import { concat } from '@graphprotocol/graph-ts/helper-functions'
import { Swap } from '../types/templates/Pair/Pair'
import { PairCreated } from '../types/Factory/Factory'
import { Pair as PairTemplate } from '../types/templates'
import { Pair, Candle } from '../types/schema'

export function handleNewPair(event: PairCreated): void {
    let pair = new Pair(event.params.pair.toHex());
    pair.token0 = event.params.token0;
    pair.token1 = event.params.token1;
    pair.factory = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
    pair.save();

    PairTemplate.create(event.params.pair)
}

export function handleSwap(event: Swap): void {
    let token0Amount: BigInt = event.params.amount0In.minus(event.params.amount0Out).abs();
    let token1Amount: BigInt = event.params.amount1Out.minus(event.params.amount1In).abs();
    if (token0Amount.isZero() || token1Amount.isZero()) {
        return;
    }
    
    let pair = Pair.load(event.address.toHex());
    let price = token0Amount.divDecimal(token1Amount.toBigDecimal());
    let tokens = concat(pair.token0, pair.token1);
    let timestamp = event.block.timestamp.toI32();

    let periods: i32[] = [1*60, 5*60, 10*60, 15*60, 30*60, 60*60, 4*60*60, 12*60*60, 24*60*60, 7*24*60*60];
    for (let i = 0; i < periods.length; i++) {
        let time_id = timestamp / periods[i];
        let candle_id = concat(concat(Bytes.fromI32(time_id), Bytes.fromI32(periods[i])), tokens).toHex();
        let candle = Candle.load(candle_id);
        if (candle === null) {
            candle = new Candle(candle_id);
            candle.time = timestamp;
            candle.period = periods[i];
            candle.token0 = pair.token0;
            candle.token1 = pair.token1;
            candle.open = price;
            candle.low = price;
            candle.high = price;
            candle.token0TotalAmount = BigInt.fromI32(0);
            candle.token1TotalAmount = BigInt.fromI32(0);
        }
        else {
            if (price < candle.low) {
                candle.low = price;
            }
            if (price > candle.high) {
                candle.high = price;
            }
        }

        candle.close = price;
        candle.lastBlock = event.block.number.toI32();
        candle.token0TotalAmount = candle.token0TotalAmount.plus(token0Amount);
        candle.token1TotalAmount = candle.token1TotalAmount.plus(token1Amount);
        candle.save();
    }
}
