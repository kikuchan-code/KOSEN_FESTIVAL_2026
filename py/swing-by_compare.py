"""
③ 差の計算版

① 実測データ版（swing-by_measurement_data.py）と
② 軌道計算版（swing-by_calculate.py）を読み込んで、
スイングバイ前後の「速度のちがい」を計算します。

・速度ベクトルの差の大きさ  |v② - v①|   （向きも含めたずれ）
・速さの差                   |v②| - |v①|  （大きさだけのずれ。+ なら②のほうが速い）

使い方：①②③の3つの .py ファイルを同じフォルダに置いて、このファイルを実行します。
"""

import io
import runpy
import contextlib
from pathlib import Path

import numpy as np

# ①②のファイルがある場所（ブラウザ上で実行するときは現在のフォルダ）
BASE_DIR = Path(__file__).resolve().parent if "__file__" in globals() else Path.cwd()


def load(filename):
    """ .py を実行して、変数（results など）を辞書で受け取る。
        ①②の print は表示しない。 """
    with contextlib.redirect_stdout(io.StringIO()):
        return runpy.run_path(str(BASE_DIR / filename))


def norm(v):
    return float(np.linalg.norm(v))


def short_period(start, end):
    """ 1979/07/07 → 07/12 のような短い表記 """
    if start.year == end.year:
        return f"{start:%Y/%m/%d} → {end:%m/%d}"
    return f"{start:%Y/%m/%d} → {end:%Y/%m/%d}"


# -------------------------------------------------------------------------------------------------
#  ①②の結果を読み込む
# -------------------------------------------------------------------------------------------------
data_1 = load("swing-by_measurement_data.py")
data_2 = load("swing-by_calculate.py")

# ① results = (惑星, 直前の速度(惑星基準), 直後の速度(惑星基準), 惑星の速度(直前/太陽基準), 惑星の速度(直後/太陽基準))
# ② results = (惑星, 計算結果, 直前の速度(惑星基準), 惑星の速度(直前/太陽基準), 惑星の速度(直後/太陽基準))
rows_1 = data_1["results"]
rows_2 = data_2["results"]
periods = data_2["SIM_PERIODS"]   # 惑星ごとの (開始時刻, 終了時刻, 最接近日)

# -------------------------------------------------------------------------------------------------
#  読み込んだ results の形をチェックする（並びが違うと、エラーにならずに別の数値で計算されてしまうため）
# -------------------------------------------------------------------------------------------------
def is_vec3(x):
    """ 数が3つ並んだ速度ベクトルかどうか """
    try:
        return np.asarray(x, dtype=float).shape == (3,)
    except (TypeError, ValueError):
        return False


def check_rows(label, rows, result_index):
    """ results の各行が (惑星名, ..., ベクトル ...) の並びになっているか確認する
        result_index：② の計算結果（辞書）が入っている位置（row[1:] の何番目か）。① は None """
    if len(rows) != len(periods):
        raise ValueError(f"{label}：惑星の数が {len(rows)} 個です（SIM_PERIODS は {len(periods)} 個）")
    for row in rows:
        if len(row) != 5 or not isinstance(row[0], str):
            raise ValueError(f"{label}：results の1行は (惑星名, 4つのデータ) の5個の並びにしてください: {row[:1]}")
        if row[0] not in periods:
            raise KeyError(f"{label}：惑星名「{row[0]}」が SIM_PERIODS にありません（表記をそろえてください）")
        for i, item in enumerate(row[1:], start=1):
            if i == result_index:
                if not (isinstance(item, dict) and is_vec3(item.get("v"))):
                    raise ValueError(f"{label}：{row[0]} の {i + 1} 番目は、'v' を持つ計算結果の辞書にしてください")
            elif not is_vec3(item):
                raise ValueError(f"{label}：{row[0]} の {i + 1} 番目は、数が3つのベクトルにしてください")


check_rows("①", rows_1, None)
check_rows("②", rows_2, 1)
if [r[0] for r in rows_1] != [r[0] for r in rows_2]:
    raise ValueError("①と②で惑星の順番が違います")
if rows_1[-1][0] != "海王星":
    raise ValueError("最後の惑星は海王星にしてください（最終速度の計算に使います）")


# -------------------------------------------------------------------------------------------------
#  惑星ごとに速度の差を計算する
# -------------------------------------------------------------------------------------------------
planets = []

for (name, vo1, vf1, vi_p1, vf_p1), (name2, res2, vo2, vi_p2, vf_p2) in zip(rows_1, rows_2):
    # 惑星基準の速度
    pre_1, post_1 = np.asarray(vo1), np.asarray(vf1)
    pre_2, post_2 = np.asarray(vo2), np.asarray(res2["v"])

    # 太陽基準の速度（惑星基準の速度に、惑星自身の速度を足す）
    pre_sun_1, post_sun_1 = pre_1 + vi_p1, post_1 + vf_p1
    pre_sun_2, post_sun_2 = pre_2 + vi_p2, post_2 + vf_p2

    start, end, closest = periods[name]

    planets.append({
        "planet": name,
        "period": short_period(start, end),
        "start": f"{start:%Y-%m-%d %H:%M}",
        "end": f"{end:%Y-%m-%d %H:%M}",
        "days": int((end - start).days),
        "closest": f"{closest:%Y-%m-%d}",

        # 速度ベクトルの差の大きさ [km/s]（太陽基準でも惑星基準でも同じ値）
        "pre_dv": norm(pre_2 - pre_1),
        "post_dv": norm(post_2 - post_1),

        # 速さの差 [km/s]（惑星基準、② - ①）
        "pre_ds": norm(pre_2) - norm(pre_1),
        "post_ds": norm(post_2) - norm(post_1),

        # 速さそのもの [km/s]
        "pre_speed_1": norm(pre_1), "pre_speed_2": norm(pre_2),
        "post_speed_1": norm(post_1), "post_speed_2": norm(post_2),
        "pre_speed_sun_1": norm(pre_sun_1), "pre_speed_sun_2": norm(pre_sun_2),
        "post_speed_sun_1": norm(post_sun_1), "post_speed_sun_2": norm(post_sun_2),
    })

# 海王星スイングバイ終了後の速度（太陽基準）
end_1 = np.asarray(rows_1[-1][2]) + rows_1[-1][4]
end_2 = np.asarray(rows_2[-1][1]["v"]) + rows_2[-1][4]
final = {
    "dv": norm(end_2 - end_1),
    "ds": norm(end_2) - norm(end_1),
    "speed_1": norm(end_1),
    "speed_2": norm(end_2),
}

# ページ（script.js）が読み取る結果
DIFF_RESULT = {"planets": planets, "final": final}


# -------------------------------------------------------------------------------------------------
#  表示
# -------------------------------------------------------------------------------------------------
def signed(x):
    return f"{x:+.6f}"


print("速度のちがい（② - ①）　単位：km/s")
print("・|Δv| = 速度ベクトルの差の大きさ")
print("・Δ速さ = 速さの差（+ なら②のほうが速い）")
print("・直前は期間の開始時刻、直後は終了時刻の速度")

for p in planets:
    print(f"\n★ {p['planet']}でのスイングバイ")
    print(f"シミュレーションの時間（UT） = {p['start']} → {p['end']}（{p['days']}日間）")
    print(f"最接近日 = {p['closest']}")

    for key, label in (("pre", "スイングバイ直前"), ("post", "スイングバイ直後")):
        print(f"{label}")
        print(f"  速度ベクトルの差の大きさ |Δv| = {p[key + '_dv']:.6f}")
        print(f"  速さの差 Δ速さ（惑星基準）   = {signed(p[key + '_ds'])}")
        print(f"  速さ（惑星基準）  ① = {p[key + '_speed_1']:.6f}  ② = {p[key + '_speed_2']:.6f}")
        print(f"  速さ（太陽基準）  ① = {p[key + '_speed_sun_1']:.6f}  ② = {p[key + '_speed_sun_2']:.6f}")

print("\nスイングバイ終了後の速度（太陽基準）")
print(f"  速度ベクトルの差の大きさ |Δv| = {final['dv']:.6f}")
print(f"  速さの差 Δ速さ               = {signed(final['ds'])}")
print(f"  速さ  ① = {final['speed_1']:.6f}  ② = {final['speed_2']:.6f}")
