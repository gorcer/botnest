
-- Get profit stat
select 
 t.dt, t.spendUSDT, t.profit, (t.profit / t.spendUSDT)
 from
 (
SELECT 
TO_CHAR(o."createdAt", 'YYYY-MM-DD') as dt,
sum(
case when type = 'buy' then amount2 else 0 end
) as spendUSDT,
sum(profit) as profit
from "order" o
group by dt
order by dt desc
) as t



-- Expected rate

select 
order_id
createdAt,
t."elapsedDays",
t."elapsedSeconds",
orderRate,
currentRate,
(orderRate * (1 + (0.00075*2 + expectedProfit/100))) as expectedRate,
currentProfit,
expectedProfit
from
(
SELECT 
"order"."id" AS "order_id",
"order"."createdAt",
(extract(epoch from now()) - "order"."createdAtSec")/60/60/24 as "elapsedDays",
(extract(epoch from now()) - "order"."createdAtSec") as "elapsedSeconds",
"order"."rate" as orderRate,
"pair"."buyRate" as currentRate,
100*(( ("pair"."buyRate" * ( 1 - 0.00075*2)) / "order"."rate")-1) as currentProfit,
case
          when
            (extract(epoch from now()) - "order"."createdAtSec") < 86400
          then
            ( 0.000009512937595 * (extract(epoch from now()) - "order"."createdAtSec") )
          else
            ( 0.000000951293760 * (extract(epoch from now()) - "order"."createdAtSec") )
        end as expectedProfit
FROM "order" "order" 
INNER JOIN "pair" "pair" ON "pair"."currency1" = "order".currency1 AND "pair"."currency2" = "order".currency2 
WHERE 
	"order".side = 'buy' and	
	"order"."createdAtSec" < extract(epoch from now()) AND 
	"order"."isActive" = true AND 
	"order"."prefilled" < "order"."amount1"
) as t
order by expectedRate;