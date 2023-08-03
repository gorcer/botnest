
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