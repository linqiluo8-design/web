import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWrite } from "@/lib/permissions"

// 提现配置初始化数据
const withdrawalConfigs = [
  // ===== 基础配置 =====
  {
    key: "withdrawal_auto_approve",
    value: "false",
    type: "boolean",
    category: "withdrawal",
    description: "是否启用提现自动审核（默认关闭，建议测试完成后再启用）"
  },
  {
    key: "withdrawal_min_amount",
    value: "100",
    type: "number",
    category: "withdrawal",
    description: "最低提现金额（元）"
  },
  {
    key: "withdrawal_max_amount",
    value: "50000",
    type: "number",
    category: "withdrawal",
    description: "最高提现金额（元）"
  },
  {
    key: "withdrawal_fee_rate",
    value: "0.02",
    type: "number",
    category: "withdrawal",
    description: "提现手续费率（如 0.02 表示 2%）"
  },
  {
    key: "commission_settlement_cooldown_days",
    value: "15",
    type: "number",
    category: "withdrawal",
    description: "佣金结算冷静期（天），订单支付后需等待此期限才能结算佣金，防止退款风险"
  },

  // ===== 自动审核条件配置 =====
  {
    key: "withdrawal_auto_max_amount",
    value: "5000",
    type: "number",
    category: "withdrawal",
    description: "自动审核最大金额（元），超过此金额必须人工审核"
  },
  {
    key: "withdrawal_auto_min_days",
    value: "30",
    type: "number",
    category: "withdrawal",
    description: "自动审核要求的最少注册天数，新注册分销商需人工审核"
  },
  {
    key: "withdrawal_auto_require_verified",
    value: "false",
    type: "boolean",
    category: "withdrawal",
    description: "自动审核是否要求实名认证（建议启用以提高安全性）"
  },
  {
    key: "withdrawal_bank_info_stable_days",
    value: "7",
    type: "number",
    category: "withdrawal",
    description: "银行信息稳定期要求（天），最近变更过银行信息需人工审核"
  },

  // ===== 风控规则配置 =====
  {
    key: "withdrawal_daily_count_limit",
    value: "3",
    type: "number",
    category: "withdrawal",
    description: "每日提现次数限制，超过限制将被拒绝"
  },
  {
    key: "withdrawal_daily_amount_limit",
    value: "10000",
    type: "number",
    category: "withdrawal",
    description: "每日提现金额限制（元），超过限制将被拒绝"
  },
  {
    key: "withdrawal_monthly_amount_limit",
    value: "50000",
    type: "number",
    category: "withdrawal",
    description: "每月提现总额限制（元），超过限制将被拒绝"
  },

  // ===== 风险评分权重配置 =====
  {
    key: "withdrawal_risk_weight_frozen",
    value: "100",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：账户冻结（直接拒绝）"
  },
  {
    key: "withdrawal_risk_weight_large_amount",
    value: "30",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：大额提现（≥自动审核最大金额）"
  },
  {
    key: "withdrawal_risk_weight_first_withdrawal",
    value: "20",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：首次提现"
  },
  {
    key: "withdrawal_risk_weight_not_verified",
    value: "15",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：未实名认证"
  },
  {
    key: "withdrawal_risk_weight_new_account",
    value: "15",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：新注册账户（<最少注册天数）"
  },
  {
    key: "withdrawal_risk_weight_high_risk_account",
    value: "10",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：高风险账户（人工标记）"
  },
  {
    key: "withdrawal_risk_weight_bank_changed",
    value: "10",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：银行信息近期变更"
  },
  {
    key: "withdrawal_risk_weight_medium_risk_account",
    value: "5",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：中风险账户（人工标记）"
  },
  {
    key: "withdrawal_risk_weight_daily_limit",
    value: "5",
    type: "number",
    category: "withdrawal_risk",
    description: "风险权重：超过每日提现限制"
  },

  // ===== 风险等级阈值配置 =====
  {
    key: "withdrawal_risk_threshold_auto",
    value: "10",
    type: "number",
    category: "withdrawal_risk",
    description: "自动审核风险评分阈值，低于此分数可自动审核"
  },
  {
    key: "withdrawal_risk_threshold_manual",
    value: "30",
    type: "number",
    category: "withdrawal_risk",
    description: "人工审核风险评分阈值，高于此分数记录安全警报"
  }
]

// GET 方法：显示初始化页面
export async function GET(req: Request) {
  try {
    // 检查权限
    await requireWrite('DISTRIBUTION')

    // 检查当前配置数量
    const existingCount = await prisma.systemConfig.count({
      where: {
        category: {
          in: ['withdrawal', 'withdrawal_risk']
        }
      }
    })

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>初始化提现配置</title>
      <meta charset="utf-8">
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 800px;
          margin: 50px auto;
          padding: 20px;
          background: #f5f5f5;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #333; margin-bottom: 10px; }
        .status {
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
          background: ${existingCount > 0 ? '#fef3c7' : '#dbeafe'};
          border-left: 4px solid ${existingCount > 0 ? '#f59e0b' : '#3b82f6'};
        }
        .btn {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
        }
        .btn:hover { background: #2563eb; }
        .btn:disabled { background: #9ca3af; cursor: not-allowed; }
        #result {
          margin-top: 20px;
          padding: 15px;
          border-radius: 5px;
          display: none;
        }
        .success { background: #d1fae5; border-left: 4px solid #10b981; }
        .error { background: #fee2e2; border-left: 4px solid #ef4444; }
        .info { color: #6b7280; font-size: 14px; margin-top: 20px; }
        ul { margin: 10px 0; padding-left: 20px; }
        code { background: #f3f4f6; padding: 2px 6px; border-radius: 3px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔧 初始化提现配置</h1>
        <p>此工具用于在数据库中创建所有提现相关的系统配置项</p>

        <div class="status">
          <strong>当前状态：</strong>
          ${existingCount > 0
            ? `已找到 ${existingCount} 个配置项。再次执行将只创建缺失的配置。`
            : '数据库中暂无配置项，需要执行初始化。'}
        </div>

        <button id="initBtn" class="btn" onclick="initialize()">
          ${existingCount > 0 ? '补充缺失配置' : '开始初始化'}
        </button>

        <div id="result"></div>

        <div class="info">
          <p><strong>将创建的配置项包括：</strong></p>
          <ul>
            <li>基础配置（5项）：自动审核开关、金额限制、手续费率、<strong>冷静期天数</strong>等</li>
            <li>自动审核条件（4项）：最大金额、注册天数、实名认证等</li>
            <li>风控限制（3项）：每日/每月提现限制</li>
            <li>风险权重（9项）：各种风险因素的评分权重</li>
            <li>风险阈值（2项）：自动审核和人工审核的阈值</li>
          </ul>
          <p>共 <strong>26</strong> 个配置项</p>
        </div>
      </div>

      <script>
        async function initialize() {
          const btn = document.getElementById('initBtn');
          const result = document.getElementById('result');

          btn.disabled = true;
          btn.textContent = '初始化中...';
          result.style.display = 'none';

          try {
            const response = await fetch('/api/backendmanager/init-withdrawal-configs', {
              method: 'POST',
              credentials: 'include'
            });

            const data = await response.json();

            result.style.display = 'block';

            if (data.success) {
              result.className = 'success';
              result.innerHTML = \`
                <strong>✅ 初始化成功！</strong><br><br>
                新创建：<strong>\${data.created}</strong> 个配置项<br>
                已存在：<strong>\${data.skipped}</strong> 个配置项<br>
                总计：<strong>\${data.total}</strong> 个配置项<br><br>
                <a href="/backendmanager/distribution/withdrawal-config" style="color: #3b82f6; text-decoration: none;">
                  → 前往配置页面查看和编辑
                </a>
              \`;

              // 3秒后自动跳转
              setTimeout(() => {
                window.location.href = '/backendmanager/distribution/withdrawal-config';
              }, 3000);
            } else {
              result.className = 'error';
              result.innerHTML = \`<strong>❌ 初始化失败</strong><br><br>\${data.error || '未知错误'}\`;
              btn.disabled = false;
              btn.textContent = '重试';
            }
          } catch (error) {
            result.style.display = 'block';
            result.className = 'error';
            result.innerHTML = \`<strong>❌ 请求失败</strong><br><br>\${error.message}\`;
            btn.disabled = false;
            btn.textContent = '重试';
          }
        }
      </script>
    </body>
    </html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return new Response(
        `<html><body><h1>401 未授权</h1><p>请先登录管理员账号</p><a href="/auth/signin">前往登录</a></body></html>`,
        { status: 401, headers: { 'Content-Type': 'text/html' } }
      );
    }

    return new Response(
      `<html><body><h1>500 错误</h1><p>${error.message}</p></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

// 初始化提现配置
export async function POST(req: Request) {
  try {
    // 需要分销管理的写权限
    await requireWrite('DISTRIBUTION')

    // 获取自定义配置值
    const body = await req.json().catch(() => ({}))
    const customValues = body.customValues || {}

    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (const config of withdrawalConfigs) {
      try {
        // 检查配置是否已存在
        const existing = await prisma.systemConfig.findUnique({
          where: { key: config.key }
        })

        if (existing) {
          skipped++
          continue
        }

        // 使用自定义值（如果提供）或默认值
        const value = customValues[config.key] !== undefined
          ? customValues[config.key]
          : config.value

        // 创建配置
        await prisma.systemConfig.create({
          data: {
            ...config,
            value: value.toString()
          }
        })
        created++
      } catch (error: any) {
        errors.push(`${config.key}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      total: withdrawalConfigs.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `成功创建 ${created} 个配置项，跳过 ${skipped} 个已存在的配置项`
    })

  } catch (error: any) {
    if (error.message === "未授权，请先登录") {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    console.error("初始化提现配置失败:", error)
    return NextResponse.json(
      { error: "初始化配置失败" },
      { status: 500 }
    )
  }
}
