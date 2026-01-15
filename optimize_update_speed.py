#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
优化天勤实盘更新速度的示例代码
"""

from tqsdk import TqApi, TqAuth

def main():
    api = TqApi(auth=TqAuth("your_username", "your_password"))
    account = api.get_account()
    
    # ❌ 错误示例：在 wait_update() 之间做大量处理
    """
    while True:
        # 大量处理逻辑
        complex_calculation()
        heavy_io_operation()
        long_running_process()
        
        api.wait_update()  # 调用频率低，权益更新慢
        if api.is_changing(account):
            print(f"权益: {account.balance}")
    """
    
    # ✅ 正确示例1：优先调用 wait_update()，使用 is_changing 判断
    print("方案1：优先调用 wait_update()")
    while True:
        api.wait_update()  # 优先调用，保持高频更新
        
        # 只在有更新时才处理
        if api.is_changing(account):
            print(f"权益更新: {account.balance}, 可用资金: {account.available}")
        
        # 轻量级处理可以放在这里
        # 但避免耗时操作
        
    # ✅ 正确示例2：使用 deadline 参数，定期处理
    """
    import time
    
    print("方案2：使用 deadline 定期处理")
    last_process_time = time.time()
    process_interval = 1.0  # 每秒处理一次
    
    while True:
        deadline = time.time() + 0.1  # 100ms 超时
        api.wait_update(deadline=deadline)
        
        # 及时检查账户更新
        if api.is_changing(account):
            print(f"权益更新: {account.balance}")
        
        # 定期执行耗时操作
        current_time = time.time()
        if current_time - last_process_time >= process_interval:
            heavy_operation()  # 耗时操作
            last_process_time = current_time
    """
    
    # ✅ 正确示例3：将耗时操作放到异步任务中
    """
    import asyncio
    
    print("方案3：使用异步任务处理耗时操作")
    
    async def heavy_task():
        while True:
            await asyncio.sleep(1)  # 定期执行
            complex_calculation()  # 耗时操作不影响主循环
    
    # 创建异步任务
    api.create_task(heavy_task())
    
    while True:
        api.wait_update()  # 主循环保持高频更新
        
        if api.is_changing(account):
            print(f"权益更新: {account.balance}")
    """
    
    # ✅ 正确示例4：监控特定字段变化
    """
    print("方案4：监控特定字段")
    last_balance = account.balance
    
    while True:
        api.wait_update()
        
        # 只监控权益变化，减少不必要的检查
        if api.is_changing(account, "balance"):
            current_balance = account.balance
            change = current_balance - last_balance
            print(f"权益变化: {change:+.2f}, 当前权益: {current_balance}")
            last_balance = current_balance
    """


def complex_calculation():
    """模拟耗时计算"""
    pass


def heavy_io_operation():
    """模拟耗时IO操作"""
    pass


def long_running_process():
    """模拟长时间运行的过程"""
    pass


if __name__ == "__main__":
    main()
