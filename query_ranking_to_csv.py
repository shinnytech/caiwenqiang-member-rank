#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
查询合约成交排名/持仓排名并保存为CSV文件（增量更新版本）

使用说明：
1. 在下方【配置区域】填写你的查询参数
2. 直接运行脚本即可
3. 数据会自动增量更新到按品种命名的CSV文件中
"""

from datetime import date, timedelta
from tqsdk import TqApi, TqAuth
import os
import re
import pandas as pd
from collections import defaultdict

# ============================================================================
# 【配置区域】请在此处填写你的查询参数
# ============================================================================

# 【必填】快期账户信息
USERNAME = "chaos123"  # 填写你的快期账户邮箱
PASSWORD = "123456"   # 填写你的快期账户密码

# 【必填】要查询的合约列表（按品种分组）
# 格式：{交易所}.{品种}{月份}，例如：SHFE.rb2601, SHFE.rb2603, SHFE.rb2605
# 程序会自动按品种分组保存数据
SYMBOLS = [
    "SHFE.rb2601",
    "SHFE.rb2603",
    "SHFE.rb2605",
    # 可以添加更多合约，例如：
    # "SHFE.cu2401",
    # "DCE.m2401",
]

# 【必填】查询天数
DAYS = 100  # 返回最近N个交易日的数据，必须 >= 1

# 【可选】开始日期
# 如果填写，则返回从该日期起N个交易日的数据
# 如果为 None，则自动使用上一个交易日作为开始日期（排除当日）
START_DT = None  # 例如: date(2024, 1, 1) 或 None

# 【可选】期货公司名称
# 如果填写，则只查询该期货公司的排名数据
# 如果为 None，则返回所有期货公司的排名数据
BROKER = "D东证期货"  # 例如: "Z中信期货" 或 None

# ============================================================================
# 以下代码无需修改
# ============================================================================


def get_previous_trading_day(today=None):
    """
    计算上一个交易日（排除当日）
    简单实现：如果是周一，往前推3天；否则往前推1天
    """
    if today is None:
        today = date.today()
    
    # 获取今天是星期几（0=周一, 6=周日）
    weekday = today.weekday()
    
    if weekday == 0:  # 周一，上一个交易日是上周五
        previous_day = today - timedelta(days=3)
    elif weekday == 6:  # 周日，上一个交易日是上周五
        previous_day = today - timedelta(days=2)
    else:  # 周二到周六，上一个交易日是昨天
        previous_day = today - timedelta(days=1)
    
    return previous_day


def extract_product_code(symbol):
    """
    从合约代码中提取品种代码
    例如：SHFE.rb2601 -> rb
    """
    # 匹配格式：交易所.品种月份
    match = re.match(r'^([A-Z]+)\.([a-z]+)(\d+)$', symbol)
    if match:
        exchange = match.group(1)
        product = match.group(2)
        return exchange, product
    return None, None


def get_csv_filename(exchange, product, broker=None):
    """
    生成CSV文件名：{交易所}_{品种}.csv
    例如：SHFE_rb.csv
    """
    if broker:
        broker_clean = re.sub(r'[\\/:*?"<>|\s]+', '_', broker.strip())
        return f"{exchange}_{product}_{broker_clean}.csv"
    return f"{exchange}_{product}.csv"


def load_existing_data(filename):
    """
    加载现有的CSV数据（如果存在）
    """
    if os.path.exists(filename):
        try:
            df = pd.read_csv(filename, encoding='utf-8-sig')
            print(f"  [OK] 加载现有数据: {len(df)} 条记录")
            return df
        except Exception as e:
            print(f"  [WARN] 加载现有数据失败: {e}，将创建新文件")
            return pd.DataFrame()
    return pd.DataFrame()


def merge_and_deduplicate(old_df, new_df):
    """
    合并新旧数据并去重
    去重规则：ranking_type, datetime, symbol, broker 相同的记录只保留一条（保留新的）
    """
    if old_df.empty:
        return new_df
    
    if new_df.empty:
        return old_df
    
    # 合并数据
    combined = pd.concat([old_df, new_df], ignore_index=True)
    
    # 去重：保留最新的记录
    # 使用 ranking_type, datetime, symbol, broker 作为唯一键
    key_columns = ['ranking_type', 'datetime', 'symbol', 'broker']
    
    # 确保所有必需的列都存在
    for col in key_columns:
        if col not in combined.columns:
            print(f"  [WARN] 警告：数据中缺少列 '{col}'，无法去重")
            return combined
    
    # 按日期排序，确保最新的数据在后面
    if 'datetime' in combined.columns:
        combined = combined.sort_values('datetime', ascending=True)
    
    # 去重，保留最后一条（最新的）
    combined = combined.drop_duplicates(subset=key_columns, keep='last')
    
    return combined


def query_symbol_data(api, symbol, ranking_types, days, start_dt, broker):
    """
    查询单个合约的所有排名数据
    """
    all_dfs = []
    
    for ranking_type, type_name in ranking_types:
        try:
            print(f"    正在查询 {symbol} 的 {type_name}...")
            df = api.query_symbol_ranking(
                symbol=symbol,
                ranking_type=ranking_type,
                days=days,
                start_dt=start_dt,
                broker=broker
            )
            
            if len(df) > 0:
                # 添加排名类型标识列
                df['ranking_type'] = ranking_type
                df['ranking_type_name'] = type_name
                all_dfs.append(df)
                print(f"      [OK] {type_name} 查询完成，共 {len(df)} 条数据")
            else:
                print(f"      [WARN] {type_name} 查询完成，但无数据")
        except Exception as e:
            print(f"      [FAIL] {type_name} 查询失败: {e}")
    
    if all_dfs:
        combined = pd.concat(all_dfs, ignore_index=True)
        # 重新排列列的顺序
        cols = ['ranking_type', 'ranking_type_name'] + \
               [col for col in combined.columns if col not in ['ranking_type', 'ranking_type_name']]
        combined = combined[cols]
        return combined
    return pd.DataFrame()


def main():
    print("=" * 60)
    print("合约成交排名/持仓排名查询工具（增量更新版）")
    print("=" * 60)
    print()
    
    # 参数验证
    if not USERNAME or USERNAME == "your_email@example.com":
        print("错误: 请先填写 USERNAME (快期账户邮箱)")
        return
    
    if not PASSWORD or PASSWORD == "your_password":
        print("错误: 请先填写 PASSWORD (快期账户密码)")
        return
    
    if not SYMBOLS or len(SYMBOLS) == 0:
        print("错误: 请先填写 SYMBOLS (合约代码列表)")
        return
    
    if DAYS < 1:
        print("错误: DAYS 必须大于等于 1")
        return
    
    # 如果开始日期为None，自动计算上一个交易日（排除当日）
    actual_start_dt = START_DT
    
    # 按品种分组合约
    symbols_by_product = defaultdict(list)
    for symbol in SYMBOLS:
        exchange, product = extract_product_code(symbol)
        if exchange and product:
            symbols_by_product[(exchange, product)].append(symbol)
        else:
            print(f"警告: 无法解析合约代码 {symbol}，跳过")
    
    if not symbols_by_product:
        print("错误: 没有有效的合约代码")
        return
    
    print("=" * 60)
    print("正在连接服务器并查询数据...")
    print("=" * 60)
    print(f"合约数量: {len(SYMBOLS)}")
    print(f"品种数量: {len(symbols_by_product)}")
    print(f"查询天数: {DAYS}")
    print(f"开始日期: {actual_start_dt}")
    if BROKER:
        print(f"期货公司: {BROKER}")
    print()
    
    # 定义三种排名类型
    ranking_types = [
        ('VOLUME', '成交量排名'),
        ('LONG', '多头持仓排名'),
        ('SHORT', '空头持仓排名')
    ]
    
    api = None
    try:
        # 创建API实例
        api = TqApi(auth=TqAuth(USERNAME, PASSWORD))
        
        # 按品种处理数据
        for (exchange, product), symbols in symbols_by_product.items():
            print(f"\n{'='*60}")
            print(f"处理品种: {exchange}.{product} (共 {len(symbols)} 个合约)")
            print(f"{'='*60}")
            
            # 生成文件名
            csv_filename = get_csv_filename(exchange, product, BROKER)
            
            # 加载现有数据
            existing_df = load_existing_data(csv_filename)
            
            # 存储该品种所有合约的新数据
            product_new_data = []
            
            # 查询每个合约的数据
            for symbol in symbols:
                print(f"\n  查询合约: {symbol}")
                symbol_df = query_symbol_data(
                    api, symbol, ranking_types, DAYS, actual_start_dt, BROKER
                )
                
                if len(symbol_df) > 0:
                    product_new_data.append(symbol_df)
            
            # 合并该品种所有合约的数据
            if product_new_data:
                new_df = pd.concat(product_new_data, ignore_index=True)
                print(f"\n  {exchange}.{product} 新数据: {len(new_df)} 条记录")
                
                # 与现有数据合并并去重
                merged_df = merge_and_deduplicate(existing_df, new_df)
                
                # 统计信息
                old_count = len(existing_df)
                new_count = len(new_df)
                merged_count = len(merged_df)
                added_count = merged_count - old_count
                
                # 保存为CSV
                merged_df.to_csv(csv_filename, index=False, encoding='utf-8-sig')
                
                print(f"\n  [OK] 数据已保存到: {os.path.abspath(csv_filename)}")
                print(f"    原有数据: {old_count} 条")
                print(f"    新增数据: {new_count} 条")
                print(f"    合并后总计: {merged_count} 条")
                print(f"    实际新增: {added_count} 条（去重后）")
            else:
                print(f"\n  [WARN] {exchange}.{product} 没有新数据")
                if len(existing_df) > 0:
                    print(f"    保留现有数据: {len(existing_df)} 条")
        
        print()
        print("=" * 60)
        print("查询完成！")
        print("=" * 60)
        print(f"共处理 {len(symbols_by_product)} 个品种")
        print()
        
    except Exception as e:
        print()
        print("=" * 60)
        print("错误: 查询失败")
        print("=" * 60)
        print(f"错误信息: {str(e)}")
        import traceback
        traceback.print_exc()
        print()
        print("可能的原因:")
        print("1. 网络连接问题")
        print("2. 账户信息错误")
        print("3. 合约代码不存在")
        print("4. 参数设置错误")
        print("5. 数据更新时间未到（数据更新时间: 18:30~19:00）")
        
    finally:
        # 关闭API连接
        if api:
            api.close()
            print("已关闭API连接")


if __name__ == "__main__":
    main()
