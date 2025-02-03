pg_dump -h localhost -U admin -W tradebot > ./tradebot.sql

-- frozen
SELECT
    b.currency,
    COALESCE(SUM(amount1), 0) as in_orders,
    COALESCE(SUM(amount1), 0) + COALESCE(SUM(b.for_fee), 0) AS total_amount1_with_fee,
    COALESCE(SUM(amount2), 0) + (AVG(rate) * COALESCE(SUM(b.for_fee), 0)) AS total_amount2_with_fee,
    AVG(rate) AS average_rate
FROM balances b
         LEFT JOIN "order" o
                   ON b.account_id = o."accountId"
                       AND b.currency = o.currency1
                       AND o."isActive" = TRUE
                       AND side = 'buy'
                       AND o.preclosed < o."amount1"
                       AND o.deleted_at IS NULL
WHERE b."account_id" = 2
GROUP BY b."currency";



-- Get profit stat
select 
 t.dt, 
 t.spendUSDT, 
 t.profit, 
 case when t.spendUSDT > 0 then
 	100*(t.profit / t.spendUSDT) 
 else 0 end	as pc
 from
 (
SELECT 
TO_CHAR(o."closedAt", 'YYYY-MM-DD') as dt,
sum(
case when side = 'buy' then amount2 else 0 end
) as spendUSDT,
sum(profit) as profit
from "order" o
group by dt
order by dt desc
) as t
where dt is not null



-- Expected sell
SELECT DISTINCT
    "order"."pairName",
    "order"."id",
    "order"."preclosed",
    "order"."accountId",
    ("order"."amount1" - "order"."preclosed") AS "needSell",
    "pair".id AS "pairId",
    "pair"."buyRate" AS "rate"
FROM "strategy_sell_awaitProfit" AS "strategy"
         INNER JOIN "order" AS "order"
                    ON "strategy"."accountId" = "order"."accountId"
         INNER JOIN "pair" AS "pair"
                    ON "pair".id = "order"."pairId"
         INNER JOIN "account" AS "account"
                    ON "strategy"."accountId" = "account".id
         INNER JOIN "balances" AS "balances"
                    ON "strategy"."accountId" = "balances"."account_id"
                        AND "balances".currency = "pair".currency1
WHERE
    100 * ((
               ("pair"."buyRate" * "order".amount1 * (1 - "pair".fee)) /
               ("order".amount2 + "order".fee)
               ) - 1) >= GREATEST(
            "strategy"."minProfit",
            ("strategy"."minAnnualProfit" / 31536000) * (extract(epoch from now()) - "order"."createdAtSec")
                         )
  AND "balances".in_orders >= "order".amount1
  AND "balances".amount >= "order".amount1
  AND "account"."is_trading_allowed" = TRUE
  AND "account"."isActive" = TRUE
  AND "account"."is_connected" = TRUE
  AND "order".side = 'buy'
  AND "order".rate < "pair"."buyRate"
  AND "order"."createdAtSec" < extract(epoch from now()) + 1
  AND "order"."isActive" = TRUE
  AND "order"."filled" = "order"."amount1"
  AND "strategy"."isActive" = TRUE
  AND ("strategy"."pairId" IS NULL OR "strategy"."pairId" = "pair".id)
  AND "order"."preclosed" < "order"."amount1"
    LIMIT 100;



-- Expected buy

SELECT 
              "order".id,
				"order"."createdAt",
				"order".rate as orderRate,
                "balance"."accountId",
                "pair"."sellRate" as "rate",
                "strategy"."cellSize",
                ("pair"."sellRate" / "strategy"."cellSize")::int,
                (floor("pair"."sellRate" / "strategy"."cellSize") * "strategy"."cellSize" ) as rateFrom,
                (ceil("pair"."sellRate" / "strategy"."cellSize") * "strategy"."cellSize") as rateTo,
                GREATEST(cast(strategy."orderAmount" as DECIMAL), "pair"."minAmount1") as amount1,
                "pair".id as "pairId",
                "pair".name as "pairName"
                 FROM "strategy_buy_fillCells" "strategy" INNER JOIN "pair" "pair" ON strategy."pairId" = "pair"."id"  INNER JOIN "balance" "balance" ON strategy."accountId" = balance."accountId" and "balance"."currency" = "pair"."currency2" 
 LEFT JOIN "order" "order" ON
                    "order"."accountId" = "balance"."accountId" and
                    "order".currency2 = "balance".currency and
                    "order"."isActive" = true and
                    "order"."preclosed" < "order"."amount1" and
                    "order".rate >= (floor("pair"."sellRate" / "strategy"."cellSize") * "strategy"."cellSize" ) and      
                    "order".rate < (ceil("pair"."sellRate" / "strategy"."cellSize") * "strategy"."cellSize" ) 
                    WHERE 
                    "balance".available > "pair"."minAmount2" AND "balance".available > strategy."orderAmount" * "pair"."sellRate" AND "pair"."isActive" = true
            
                        