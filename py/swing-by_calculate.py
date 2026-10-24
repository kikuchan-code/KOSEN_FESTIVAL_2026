from datetime import datetime
import numpy as np
import math

# ここでは、スイングバイの前後は、衛星は等速直線運動すると仮定しています。

def calculate_orbit(planet_lb,r0_vec, v0_vec, mu ,t_initial, t_final):
    """
    初期位置・速度から双曲線軌道の各パラメータを計算します。

    パラメータの意味
    ----------
    planet_lb : text
        惑星ラベル（なんの計算してるかわからんようなると思うので、ラベリングします。）
    r0_vec : array-like
        初期位置ベクトル [km]
    v0_vec : array-like
        初期速度ベクトル [km/s]
    mu : float
        重力パラメータ [km^3/s^2]
    t_initial : value
        開始日時
    t_final : value
        終了日時
    Returns
    -------
    dict
        計算した軌道パラメータ
    """

# -------------------------------------------------------------------------------------------------
#  必要な値を計算する (7.3節)
# -------------------------------------------------------------------------------------------------
    # おまじない（npで扱えるデータ形式にする）
    r0_vec = np.asarray(r0_vec, dtype=float)
    v0_vec = np.asarray(v0_vec, dtype=float)

    # 大きさ
    r0 = np.linalg.norm(r0_vec)
    v0 = np.linalg.norm(v0_vec)

    # 比軌道エネルギー
    epsilon = v0**2 / 2 - mu / r0

    # 比角運動量ベクトル
    h_vec = np.cross(r0_vec, v0_vec)
    h_mag = np.linalg.norm(h_vec)

    # 離心率ベクトル
    e_vec = np.cross(v0_vec, h_vec) / mu - r0_vec / r0
    e = np.linalg.norm(e_vec)

    # 衛星が惑星に最接近するときの惑星との距離
    rp = h_mag**2 / (mu * (1 + e))

    # 無限遠速度
    if epsilon > 0:
        v_inf = np.sqrt(2 * epsilon)
    else:
        v_inf = np.nan                  # 無効な値

    # 散乱角
    if e > 1:
        delta = 2 * np.arcsin(1 / e)
    else:
        delta = np.nan                  # 無効な値

# -------------------------------------------------------------------------------------------------
#  3次元の位置・速度に戻す (E章)
# (ニュートン法は（https://zenn.dev/kaitombow/articles/1ee53acb89eee8）を参考にしました。)
# -------------------------------------------------------------------------------------------------
# 双曲線異常（hyperbolic anomaly）H を変分法を利用してもとめていく
# ここでは、
    
    # E.1 節参照
    p_hat = e_vec / e
    h_hat = h_vec / h_mag
    q_hat = np.cross(h_hat, p_hat)
    A = mu / (2 * epsilon)

    # Hの初期値
    H_0 = math.asinh((np.dot(r0_vec, q_hat))/(A * math.sqrt(e**2 - 1)))

    # シミュレーション時間（単位は秒）
    delta_t = (t_final - t_initial).total_seconds()    # t-t_0

    # Mを計算 
    M_temp = e * math.sinh(H_0) - H_0 + math.sqrt(mu / A**3) * delta_t

    # f(H) と f'(H)
    def f(H):
        return e * math.sinh(H) - H - M_temp
    def df(H):
        return e * math.cosh(H) - 1

    # --------------------
    # ニュートン法 ここから
    # --------------------
    # 初期値
    H = H_0
    # 要求精度
    epsilon1 = 0.00001
    # とりあえずの変数
    n = 1

    while True:
        H = H - f(H) / df(H)
        #print("{}\t{:.8f}\t{:.8f}".format(n, H, f(H)))
        n += 1
        if abs(f(H)) < epsilon1:
            break
    # --------------------
    # ニュートン法 ここまで
    # --------------------

    # E.2 節参照
    x = A * (e - math.cosh(H))
    y = A * math.sqrt(e**2 - 1) * math.sinh(H)
    # E.3 節参照
    vx = -math.sqrt(mu / A) * (math.sinh(H)) / (e * math.cosh(H) - 1)
    vy = math.sqrt(mu / A) * (math.sqrt(e**2 - 1) * math.cosh(H)) / (e * math.cosh(H) - 1)

    # 位置ベクトル（シミュレーション終了時の位置）
    r = x * p_hat + y * q_hat
    # 速度ベクトル（シミュレーション終了時の速度）
    v = vx * p_hat + vy * q_hat

    # シミュレーション終了時の比軌道エネルギー
    epsilon_final = np.linalg.norm(v)**2 / 2 - mu / np.linalg.norm(r)
    
    result = {
        "planet": planet_lb,
        "epsilon": epsilon,
        "h_vec": h_vec,
        "h": h_mag,
        "e_vec": e_vec,
        "e": e,
        "rp": rp,
        "v_inf": v_inf,
        "delta": delta,
        "epsilon_final": epsilon_final,
        "r": r,
        "v": v
    }

    return result


#--------------------------------------------------
# 重力パラメータ GM [km^3/s^2]
mu_J = 1.26686534e8     # 木星
mu_S = 3.79405848e7     # 土星
mu_U = 5.79455640e6     # 天王星
mu_N = 6.83652710e6     # 海王星 
#--------------------------------------------------

#--------------------------------------------------
# ボイジャー2号の初期速度(木星基準)
v0 = np.array([-1.6803664, 10.921365, 3.5592165])
#--------------------------------------------------

#--------------------------------------------------
# 惑星の速度（太陽基準）

# 木星
vi_J = np.array([-9.01091248, -8.36949063, -3.36819208])
vf_J = np.array([-8.94363912, -8.42475325, -3.39348810])

# 土星
vi_S = np.array([1.43580201, -8.75284991, -3.67596120])
vf_S = np.array([1.46545304, -8.74686694, -3.67500241])

# 天王星
vi_U = np.array([6.64116959, -1.44904552, -7.29054608e-01])
vf_U = np.array([6.64199299, -1.44258718, -7.26217337e-01])

# 海王星
vi_N = np.array([5.28217551, 1.07625771, 3.09622254e-01])
vf_N = np.array([5.28153709, 1.07838946, 3.09897969e-01])

#--------------------------------------------------
# ボイジャー2号のスイングバイ前（シミュレーション開始時間時）の位置

# 木星スイングバイ前
rJ = np.array([1.6867716e+06, -2.6888870e+06, -9.6189106e+05])

# 土星スイングバイ前
rS = np.array([3.23652093e+06, 1.29426933e+06, 3.99380922e+05])

# 天王星スイングバイ前
rU = np.array([-2.54617975e+05, 3.24878105e+06, 1.48610057e+06])

# 海王星スイングバイ前
rN = np.array([-1.41931422e+06, 2.69688758e+06, 1.04952386e+06])
#--------------------------------------------------

#--------------------------------------------------
# シミュレーション期間
# 木星（最接近日：1979/7/9）
t0 = datetime(1979, 7, 7, 00, 0, 0)
t1 = datetime(1979, 7, 12, 00, 0, 0)

# 土星（最接近日：1981/8/25）
t2 = datetime(1981, 8, 23, 00, 0, 0)
t3 = datetime(1981, 8, 28, 00, 0, 0)

# 天王星（最接近日：1986/1/24）
t4 = datetime(1986, 1, 22, 00, 0, 0)
t5 = datetime(1986, 1, 27, 00, 0, 0)

# 海王星（最接近日：1989/8/25）
t6 = datetime(1989, 8, 23, 00, 0, 0)
t7 = datetime(1989, 8, 28, 00, 0, 0)
#--------------------------------------------------

# 関数の呼び出し
"""
注：ボイジャー2号は、惑星の距離と速度を測定している。
位置は各惑星基準のものを逐一使っているが、速度は最初のデータから数珠つなぎ的に利用しているため
一旦太陽基準の惑星の速度を外部から取得し、それを足し引きすることで基準の変換を行っている。
（A基準なら、Aの速度を0にすればいい（すなわちv_Aだけ引けばよい）。B基準にするならv_Aを足してv_Bを引けばよい。）
今回の計算は、惑星間の移動は等速直線運動すると仮定して計算している。
"""


print("計算データ")
print("ボイジャー2号の初期速度（木星基準） =", v0)

# 木星
resultJ = calculate_orbit("木星", rJ, v0, mu_J, t0, t1)

# 土星
vS_in = resultJ["v"] + vf_J - vi_S
resultS = calculate_orbit("土星", rS, vS_in, mu_S, t2, t3)

# 天王星
vU_in = resultS["v"] + vf_S - vi_U
resultU = calculate_orbit("天王星", rU, vU_in, mu_U, t4, t5)

# 海王星
vN_in = resultU["v"] + vf_U - vi_N
resultN = calculate_orbit("海王星", rN, vN_in, mu_N, t6, t7)


# 各スイングバイの速度を4種類表示
results = [
    ("木星", resultJ, v0, vi_J, vf_J),
    ("土星", resultS, vS_in, vi_S, vf_S),
    ("天王星", resultU, vU_in, vi_U, vf_U),
    ("海王星", resultN, vN_in, vi_N, vf_N),
]

for planet, result, v_in, vi, vf in results:
    print(f"\n★ {planet}でのスイングバイ")

    print("スイングバイ直前の速度（太陽基準） =", v_in + vi)
    print("スイングバイ直前の速度（惑星基準） =", v_in)
    print("スイングバイ直後の速度（惑星基準） =", result["v"])
    print("スイングバイ直後の速度（太陽基準） =", result["v"] + vf)

    # 各種計算結果を表示
    print("比角運動量ベクトル =", result["h_vec"])
    print("比角運動量の大きさ =", result["h"])
    print("離心率ベクトル =", result["e_vec"])
    print("離心率 =", result["e"])
    print("最接近距離 =", result["rp"], "km")
    print("無限遠速度 =", result["v_inf"], "km/s")
    print("散乱角 =", np.degrees(result["delta"]), "deg")
    print("終了時の位置ベクトル =", result["r"], "km")
    print("初期比軌道エネルギー =", result["epsilon"], "km^2/s^2")
    print("終了時比軌道エネルギー =", result["epsilon_final"], "km^2/s^2")
    print("比軌道エネルギーの差 =", result["epsilon_final"] - result["epsilon"], "km^2/s^2")

# 海王星スイングバイ終了後の太陽基準速度
v_end = resultN["v"] + vf_N
print(f"\nスイングバイ終了後速度（太陽基準）：{v_end}")
