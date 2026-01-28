#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试股票数据获取
"""
from tqsdk import TqApi, TqAuth

# 使用你的天勤账号
USERNAME = "chaos123"
PASSWORD = "123456"

SYMBOL = "SSE.513630"  # 股票代码

def test_stock_data():
    """测试获取股票行情和K线数据"""
    api = TqApi(auth=TqAuth(USERNAME, PASSWORD))
    
    try:
        print(f"正在获取 {SYMBOL} 的行情数据...")
        
        # 1. 获取行情
        quote = api.get_quote(SYMBOL)
        
        # 等待数据更新（重要！）
        print("等待行情数据更新...")
        api.wait_update()
        
        # 打印行情信息
        print("\n=== 行情数据 ===")
        print(f"合约代码: {quote.instrument_id}")
        print(f"合约名称: {quote.instrument_name}")
        print(f"最新价: {quote.last_price}")
        print(f"开盘价: {quote.open}")
        print(f"最高价: {quote.highest}")
        print(f"最低价: {quote.lowest}")
        print(f"昨收: {quote.pre_close}")
        print(f"成交量: {quote.volume}")
        print(f"成交额: {quote.amount}")
        print(f"更新时间: {quote.datetime}")
        
        # 2. 获取日K线数据（24*60*60 = 86400秒 = 1天）
        print(f"\n正在获取 {SYMBOL} 的日K线数据...")
        kline = api.get_kline_serial(SYMBOL, 24*60*60, data_length=30)  # 获取最近30根日K线
        
        # 等待K线数据初始化完成
        print("等待K线数据初始化...")
        while not api.is_serial_ready(kline):
            api.wait_update()
        
        # 打印K线数据
        print("\n=== K线数据（最近10根）===")
        print(kline.tail(10).to_string())
        
        # 打印统计信息
        print(f"\n=== 统计信息 ===")
        print(f"总K线数: {len(kline)}")
        print(f"最新收盘价: {kline.iloc[-1]['close']}")
        print(f"最新成交量: {kline.iloc[-1]['volume']}")
        
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        api.close()
        print("\n连接已关闭")

if __name__ == "__main__":
    test_stock_data()
