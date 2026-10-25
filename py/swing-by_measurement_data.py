import numpy as np
from datetime import datetime

# 各惑星スイングバイ直前の探査機速度 vo（惑星基準）
vo_jupiter = np.array([-1.6803664, 10.921365, 3.5592165])
vo_saturn = np.array([-11.1125, -3.35969, -0.857730])
vo_uranus = np.array([0.526199, -13.4445, -6.26447])
vo_neptune = np.array([7.52298, -14.1522, -5.26634])

# 各惑星スイングバイ直後の探査機速度 vf（惑星基準）
vf_jupiter = np.array([-12.5655, -1.13759, 0.483633])
vf_saturn = np.array([2.3286696, -10.746275, -5.2417426])
vf_uranus = np.array([6.17890, -12.6856, -4.67733])
vf_neptune = np.array([-0.660299, -6.34800, -15.5836])

# 各惑星の速度（太陽基準）
# vi：スイングバイ前、vf：スイングバイ後

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


# データの時間（UT）
# 速度データは NASA/JPL Horizons から取得したもので、
#   「スイングバイ直前」の速度 = 開始時刻の値、「スイングバイ直後」の速度 = 終了時刻の値
# 各項目は (開始時刻, 終了時刻, 最接近日)
DATA_TIMES = {
    "木星":   (datetime(1979, 7, 7),  datetime(1979, 7, 12), datetime(1979, 7, 9)),
    "土星":   (datetime(1981, 8, 23), datetime(1981, 8, 28), datetime(1981, 8, 25)),
    "天王星": (datetime(1986, 1, 22), datetime(1986, 1, 27), datetime(1986, 1, 24)),
    "海王星": (datetime(1989, 8, 23), datetime(1989, 8, 28), datetime(1989, 8, 25)),
}


def format_time_lines(start, end, closest):
    """データの時間を2行の文字列にして返す"""
    days = (end - start).days
    return (
        f"データの時間（UT） = {start:%Y-%m-%d %H:%M} → {end:%Y-%m-%d %H:%M}（{days}日間）\n"
        f"最接近日 = {closest:%Y-%m-%d}"
    )


# 各惑星の速度データ
results = [
    ("木星", vo_jupiter, vf_jupiter, vi_J, vf_J),
    ("土星", vo_saturn, vf_saturn, vi_S, vf_S),
    ("天王星", vo_uranus, vf_uranus, vi_U, vf_U),
    ("海王星", vo_neptune, vf_neptune, vi_N, vf_N),
]

print("惑星の太陽基準の速度データ" ,"\n")
print("スイングバイ前の木星の速度（太陽基準） =", vi_J)
print("スイングバイ後の木星の速度（太陽基準） =", vf_J ,"\n")
print("スイングバイ前の土星の速度（太陽基準） =", vi_S)
print("スイングバイ後の土星の速度（太陽基準） =", vf_S,"\n")
print("スイングバイ前の天王星の速度（太陽基準） =", vi_U)
print("スイングバイ後の天王星の速度（太陽基準） =", vf_U,"\n")
print("スイングバイ前の海王星の速度（太陽基準） =", vi_N)
print("スイングバイ後の海王星の速度（太陽基準） =", vf_N,"\n")

print("")

print("ボイジャー2号のスイングバイ速度データ")

for planet, vo, vf, vi_planet, vf_planet in results:
    print(f"\n★ {planet}でのスイングバイ")
    print(format_time_lines(*DATA_TIMES[planet]))

    print("スイングバイ直前の速度（太陽基準） =", vo + vi_planet)
    print("スイングバイ直前の速度（惑星基準） =", vo)
    print("スイングバイ直後の速度（惑星基準） =", vf)
    print("スイングバイ直後の速度（太陽基準） =", vf + vf_planet)

# 海王星スイングバイ終了後の太陽基準速度
vf_after_swingby_sun = np.round(vf_neptune + vf_N, 6)

print("\nスイングバイ終了後速度（太陽基準） =", vf_after_swingby_sun)
