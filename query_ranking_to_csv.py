#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
查询合约成交排名/持仓排名并保存为CSV文件

使用说明：
1. 在下方【配置区域】填写你的查询参数
2. 直接运行脚本即可
3. 数据会自动保存为CSV文件
"""

from datetime import date, timedelta
from tqsdk import TqApi, TqAuth
import os
import re
import pandas as pd

# ============================================================================
# 【配置区域】请在此处填写你的查询参数
# ============================================================================

# 【必填】快期账户信息
USERNAME = "chaos123"  # 填写你的快期账户邮箱
PASSWORD = "123456"            # 填写你的快期账户密码

# 【必填】合约代码
SYMBOL = "SHFE.rb2601"  # 例如: SHFE.cu2109, DCE.m2109, CZCE.CF2109 等

# 【必填】查询天数
DAYS = 100  # 返回最近N个交易日的数据，必须 >= 1s

# 【可选】开始日期
# 如果填写，则返回从该日期起N个交易日的数据
# 如果为 None，则自动使用上一个交易日作为开始日期（排除当日）
# 格式: date(2024, 1, 1) 或 None
START_DT = None  # 例如: date(2024, 1, 1) 或 None（不填则自动计算上一个交易日）

# 【可选】期货公司名称
# 如果填写，则只查询该期货公司的排名数据
# 如果为 None，则返回所有期货公司的排名数据
BROKER = "Z中信期货"  # 例如: "海通期货" 或 None

# 【可选】输出CSV文件名（备用）
# 文件名会自动生成格式：合约代码_开始日期_结束日期.csv
# 例如：SHFE_rb2605_2024-01-01_2024-12-31.csv
# 只有在无法获取日期信息时才会使用此文件名
CSV_FILENAME = "ranking_data.csv"

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


def main():
    print("=" * 60)
    print("合约成交排名/持仓排名查询工具")
    print("=" * 60)
    print()
    
    # 参数验证
    if not USERNAME or USERNAME == "your_email@example.com":
        print("错误: 请先填写 USERNAME (快期账户邮箱)")
        return
    
    if not PASSWORD or PASSWORD == "your_password":
        print("错误: 请先填写 PASSWORD (快期账户密码)")
        return
    
    if not SYMBOL:
        print("错误: 请先填写 SYMBOL (合约代码)")
        return
    
    if DAYS < 1:
        print("错误: DAYS 必须大于等于 1")
        return
    
    # 如果开始日期为None，自动计算上一个交易日（排除当日）
    actual_start_dt = START_DT
    
    # 创建API实例并查询
    print("=" * 60)
    print("正在连接服务器并查询数据...")
    print("=" * 60)
    print(f"合约代码: {SYMBOL}")
    print(f"排名类型: 成交量排名、多头持仓排名、空头持仓排名（全部）")
    print(f"查询天数: {DAYS}")
    print(f"开始日期: {actual_start_dt}")
    if BROKER:
        print(f"期货公司: {BROKER}")
    print()
    
    api = None
    try:
        # 创建API实例
        api = TqApi(auth=TqAuth(USERNAME, PASSWORD))
        
        # 定义三种排名类型
        ranking_types = [
            ('VOLUME', '成交量排名'),
            ('LONG', '多头持仓排名'),
            ('SHORT', '空头持仓排名')
        ]
        
        # 存储所有查询结果
        all_dfs = []
        
        # 依次查询三种排名类型
        for ranking_type, type_name in ranking_types:
            print(f"正在查询 {SYMBOL} 的 {type_name}...")
            df = api.query_symbol_ranking(
                symbol=SYMBOL,
                ranking_type=ranking_type,
                days=DAYS,
                start_dt=actual_start_dt,
                broker=BROKER
            )
            # 添加排名类型标识列
            df['ranking_type'] = ranking_type
            df['ranking_type_name'] = type_name
            all_dfs.append(df)
            
            # 检查返回的数据量是否符合预期（每天20条排名数据）
            if 'datetime' in df.columns:
                unique_dates = df['datetime'].nunique() if len(df) > 0 else 0
                expected_rows = DAYS * 20  # 每天20条排名数据
                print(f"  ✓ {type_name} 查询完成，共 {len(df)} 条数据")
                print(f"    预期: {DAYS} 天 × 20 条/天 = {expected_rows} 条")
                print(f"    实际: {unique_dates} 个交易日，共 {len(df)} 条数据")
            else:
                print(f"  ✓ {type_name} 查询完成，共 {len(df)} 条数据")
        
        # 合并所有数据
        combined_df = pd.concat(all_dfs, ignore_index=True)
        
        # 重新排列列的顺序，将ranking_type和ranking_type_name放在前面
        cols = ['ranking_type', 'ranking_type_name'] + [col for col in combined_df.columns if col not in ['ranking_type', 'ranking_type_name']]
        combined_df = combined_df[cols]
        
        # 从数据中提取日期范围，生成规范的文件名
        if 'datetime' in combined_df.columns and len(combined_df) > 0:
            # 将datetime转换为日期格式（临时列，用于提取日期范围）
            date_series = pd.to_datetime(combined_df['datetime']).dt.date
            start_date = date_series.min()
            end_date = date_series.max()
            
            # 生成规范的文件名：合约代码_开始日期_结束日期[_期货公司].csv
            symbol_clean = SYMBOL.replace('.', '_')  # 将点号替换为下划线，避免文件名问题
            broker_suffix = ""
            if BROKER:
                # 期货公司名称中可能包含不适合作为文件名的字符，这里做一次清洗
                broker_clean = re.sub(r'[\\\\/:*?\"<>|\\s]+', '_', BROKER.strip())
                broker_suffix = f"_{broker_clean}"
            csv_filename = f"{symbol_clean}_{start_date}_{end_date}{broker_suffix}.csv"
        else:
            # 如果无法获取日期，使用默认文件名
            csv_filename = CSV_FILENAME
            if not csv_filename.endswith('.csv'):
                csv_filename += '.csv'
        
        # 保存为CSV
        combined_df.to_csv(csv_filename, index=False, encoding='utf-8-sig')
        
        print()
        print("=" * 60)
        print("查询成功！")
        print("=" * 60)
        print(f"数据已保存到: {os.path.abspath(csv_filename)}")
        print(f"总数据行数: {len(combined_df)}")
        print(f"数据列数: {len(combined_df.columns)}")
        print()
        print("各类型数据统计:")
        print("-" * 60)
        for ranking_type, type_name in ranking_types:
            count = len(combined_df[combined_df['ranking_type'] == ranking_type])
            print(f"  {type_name}: {count} 条")
        print()
        print("数据预览（前10行）:")
        print("-" * 60)
        print(combined_df.head(10).to_string())
        print()
        
    except Exception as e:
        print()
        print("=" * 60)
        print("错误: 查询失败")
        print("=" * 60)
        print(f"错误信息: {str(e)}")
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

