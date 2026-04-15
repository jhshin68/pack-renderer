결론:

분산 등임피던스 병렬 버스 이론 (Distributed Equal-Impedance Parallel Bus
Theory)

지금까지 논의한 내용을 하나의 이론으로 통합하면, **병렬 셀 니켈 플레이트
설계는 "각 셀이 외부 회로에 접속되는 전체 경로 임피던스를 동일하게
만드는 분산 대칭 저항망 설계 이론"으로 정리할 수 있습니다.\
그리고 이를 프로그램적으로 구현하려면, 셀 배치와 니켈 연결 형상을
그래프(graph) 또는 저항망(resistive network) 으로 모델링한 뒤, 각 셀에서
공통 인출점까지의 등가 저항을 계산하여 전류 분배 오차를 최소화하는
형상**을 찾도록 만들면 됩니다.

핵심 근거:

1.  병렬 전류 균등화의 본질은 셀 전압이 아니라 **접속 경로 저항의
    균등화**입니다.

2.  4P, 5P, 그 이상 모두 같은 이론으로 설명할 수 있고, 차이는 단지
    **대칭 구현 가능성**과 **중앙/외곽 셀 보정 필요성**뿐입니다.

3.  따라서 프로그램은 "형상 그림"을 직접 다루기보다, 먼저 **노드-엣지
    저항망**으로 변환해 해석하는 방식이 가장 타당합니다.

------------------------------------------------------------------------

**1. 통합 이론**

**1-1. 이론명**

다음처럼 이름을 붙일 수 있습니다.

**Distributed Equal-Impedance Parallel Bus Theory**\
한글로는\
**분산 등임피던스 병렬 버스 이론**

------------------------------------------------------------------------

**1-2. 이론의 정의**

배터리팩의 병렬 셀군에서 니켈 플레이트 형상 설계의 목적은,\
각 셀이 외부 회로와 연결되는 전체 루프의 임피던스를 가능한 한 같게
만들어,\
충전/방전 시 셀 전류가 균등하게 분배되도록 하는 것이다.

즉 병렬 셀군의 이상 조건은:

\[\
I_1 \\approx I_2 \\approx \\cdots \\approx I_n\
\]

이를 만족시키기 위한 설계 조건은:

\[\
R\_{\\text{path},1} \\approx R\_{\\text{path},2} \\approx \\cdots
\\approx R\_{\\text{path},n}\
\]

여기서

\[\
R\_{\\text{path},k} = R\_{+,k} + R\_{-,k} + R\_{\\text{weld},k} + r_k\
\]

- (R\_{+,k}): k번째 셀의 양극측 니켈 경로 저항

- (R\_{-,k}): k번째 셀의 음극측 니켈 경로 저항

- (R\_{\\text{weld},k}): 용접 및 접촉 저항

- (r_k): 셀 내부저항

실제 설계에서는 (r_k)는 크게 바꾸기 어렵고,\
설계자가 제어하는 핵심 변수는 다음입니다.

- 경로 길이 (L)

- 단면적 (A = w \\times t)

- 분기 구조

- 인출점 위치

- 용접점 수와 위치

- fuse neck 여부

니켈 경로 저항은 기본적으로:

\[\
R = \\rho \\frac{L}{A}\
\]

로 표현할 수 있습니다.

따라서 설계의 핵심은 결국:

**각 셀의 유효 전기적 거리와 유효 단면적을 조정하여 등가 경로저항을
맞추는 것**

입니다.

------------------------------------------------------------------------

**1-3. 구조별 해석**

**A. 일자형**

- 한쪽 끝 인출일수록 경로 차이가 커짐

- 비대칭 1차원 저항망

- 가장 가까운 셀이 과부하되기 쉬움

**B. H형**

- 4P 같은 짝수 병렬에 적합

- 대칭 branch 구성 용이

- 중앙 인출 구조에 유리

**C. 프레임형**

- 전류 분산 경로가 다수 존재

- 전위 구배 완화

- hotspot 완화

- 고전류에 유리

**D. 5P 이상 홀수 구조**

- 중앙 셀이 유리해지기 쉬움

- 단순 대칭만으로는 부족

- 중앙 branch 저항 증가 또는 외곽 저항 감소 보정 필요

즉 5P 이상에서는 다음 확장 원리가 추가됩니다.

**구조적으로 완전 대칭이 불가능한 경우, 의도적 비대칭 보정을 통해 결과적
전류 대칭을 달성한다.**

------------------------------------------------------------------------

**2. 프로그램화 방법**

프로그램 구현은 아래 3단계가 가장 합리적입니다.

------------------------------------------------------------------------

**2-1. 1단계: 형상을 저항망으로 모델링**

셀과 니켈 플레이트를 아래처럼 모델링합니다.

- **노드(node)**

  - 셀 양극 탭

  - 셀 음극 탭

  - 니켈 접속점

  - 외부 출력점

- **엣지(edge)**

  - 니켈 플레이트 구간

  - 용접점

  - 셀 내부저항

각 엣지는 저항값을 가집니다.

예:

\[\
R\_{\\text{nickel}} = \\rho \\frac{L}{w t}\
\]

\[\
R\_{\\text{weld}} = \\text{상수 또는 경험값}\
\]

이렇게 하면 형상이 그림이 아니라 **회로망**이 됩니다.

------------------------------------------------------------------------

**2-2. 2단계: 각 셀 전류 계산**

각 셀을 테브난 전원으로 보고, 공통 부하점에 연결된 회로로 해석합니다.

간단한 모델:

- 셀 개방전압 (E_k)

- 셀 내부저항 (r_k)

- 접속저항 (c_k)

그러면 셀 전류는 대략:

\[\
I_k = \\frac{E_k - V\_{\\text{bus}}}{r_k + c_k}\
\]

여기서 (V\_{\\text{bus}})는 공통 노드 전압이며,\
전체 전류 조건으로부터 계산됩니다.

실용적으로는 두 가지 방식이 있습니다.

**방식 1: 단순 근사**

각 셀에서 출력점까지의 최단 경로 저항 합을 구해서 전류 분배 추정

**방식 2: 정식 해석**

저항망 전체에 대해 노달 해석(nodal analysis) 수행

실제 프로그램은 정식 해석이 맞습니다.

------------------------------------------------------------------------

**2-3. 3단계: 형상 최적화**

목적 함수 예:

\[\
J = \\sum\_{k=1}\^{n}\\left(I_k - \\bar{I}\\right)\^2\
\]

또는

\[\
J = \\max(R\_{\\text{path},k}) - \\min(R\_{\\text{path},k})\
\]

이 값을 최소화하도록:

- branch 길이

- branch 폭

- 인출점 위치

- 중앙 neck 폭

등을 조정합니다.

즉 최적화 문제로 바뀝니다.

------------------------------------------------------------------------

**3. 구현용 Python 소스**

아래 코드는 개념 검증용이면서 실제 확장 가능한 형태로 작성한 것입니다.\
핵심은:

- 병렬 셀군을 저항망으로 모델링

- 각 셀의 경로저항 계산

- 전류 분배 계산

- 균등도 평가

- 4P / 5P 예시 비교 가능

from \_\_future\_\_ import annotations

from dataclasses import dataclass, field

from typing import Dict, List, Tuple

import math

import heapq

\#
\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--

\# Core electrical model

\#
\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--

\@dataclass

class Edge:

\"\"\"Resistive edge in the network.\"\"\"

start: str

end: str

resistance_ohm: float

label: str = \"\"

\@dataclass

class Cell:

\"\"\"Battery cell model for parallel group analysis.\"\"\"

name: str

ocv_v: float = 4.0 \# Open-circuit voltage

internal_res_ohm: float = 0.020 \# 20 mOhm typical example

\@dataclass

class ParallelPackModel:

\"\"\"

Graph-based resistive model of a parallel group.

Nodes:

\- Cell terminals or nickel connection points

\- External bus/output node

For simplified current sharing analysis, each cell is treated as:

OCV source + series resistance (internal + path resistance to bus)

\"\"\"

cells: Dict\[str, Cell\] = field(default_factory=dict)

edges: List\[Edge\] = field(default_factory=list)

adjacency: Dict\[str, List\[Tuple\[str, float\]\]\] =
field(default_factory=dict)

def add_cell(self, cell: Cell) -\> None:

self.cells\[cell.name\] = cell

def add_edge(self, edge: Edge) -\> None:

self.edges.append(edge)

self.adjacency.setdefault(edge.start, \[\]).append((edge.end,
edge.resistance_ohm))

self.adjacency.setdefault(edge.end, \[\]).append((edge.start,
edge.resistance_ohm))

def shortest_path_resistance(self, source: str, target: str) -\> float:

\"\"\"

Dijkstra on resistive graph using resistance as path weight.

This is an approximation of path resistance, not full circuit reduction.

Useful for early-stage topology comparison.

\"\"\"

pq: List\[Tuple\[float, str\]\] = \[(0.0, source)\]

dist: Dict\[str, float\] = {source: 0.0}

while pq:

cur_r, node = heapq.heappop(pq)

if node == target:

return cur_r

if cur_r \> dist.get(node, math.inf):

continue

for nxt, r in self.adjacency.get(node, \[\]):

nr = cur_r + r

if nr \< dist.get(nxt, math.inf):

dist\[nxt\] = nr

heapq.heappush(pq, (nr, nxt))

raise ValueError(f\"No path found from {source} to {target}\")

def effective_cell_series_resistance(

self,

cell_node_to_bus_map: Dict\[str, str\],

bus_node: str,

weld_res_ohm: float = 0.0005,

) -\> Dict\[str, float\]:

\"\"\"

Returns total series resistance per cell:

internal resistance + weld/contact + path to bus

\"\"\"

result: Dict\[str, float\] = {}

for cell_name, graph_node in cell_node_to_bus_map.items():

cell = self.cells\[cell_name\]

path_r = self.shortest_path_resistance(graph_node, bus_node)

total_r = cell.internal_res_ohm + weld_res_ohm + path_r

result\[cell_name\] = total_r

return result

def current_distribution(

self,

cell_node_to_bus_map: Dict\[str, str\],

bus_node: str,

load_current_a: float,

weld_res_ohm: float = 0.0005,

) -\> Dict\[str, float\]:

\"\"\"

Simplified parallel source current sharing model.

Assumptions:

\- All cells have close OCV

\- Pack delivers a known total current

\- Current shares inversely proportional to series resistance

I_k = G_k / sum(G_i) \* I_total

where G_k = 1 / R_k

\"\"\"

total_res = self.effective_cell_series_resistance(

cell_node_to_bus_map=cell_node_to_bus_map,

bus_node=bus_node,

weld_res_ohm=weld_res_ohm,

)

conductance = {k: 1.0 / r for k, r in total_res.items()}

g_sum = sum(conductance.values())

currents = {k: (g / g_sum) \* load_current_a for k, g in
conductance.items()}

return currents

def evaluate_balance(

self,

cell_node_to_bus_map: Dict\[str, str\],

bus_node: str,

load_current_a: float,

weld_res_ohm: float = 0.0005,

) -\> Dict\[str, float\]:

\"\"\"

Returns useful balance metrics.

\"\"\"

currents = self.current_distribution(

cell_node_to_bus_map=cell_node_to_bus_map,

bus_node=bus_node,

load_current_a=load_current_a,

weld_res_ohm=weld_res_ohm,

)

values = list(currents.values())

mean_i = sum(values) / len(values)

max_dev = max(abs(i - mean_i) for i in values)

std_dev = math.sqrt(sum((i - mean_i) \*\* 2 for i in values) /
len(values))

imbalance_pct = (max_dev / mean_i) \* 100.0 if mean_i \> 0 else 0.0

return {

\"mean_current_a\": mean_i,

\"max_deviation_a\": max_dev,

\"std_dev_a\": std_dev,

\"imbalance_pct\": imbalance_pct,

}

\#
\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--

\# Resistance utility

\#
\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--

def nickel_resistance(

length_mm: float,

width_mm: float,

thickness_mm: float,

resistivity_ohm_m: float = 6.99e-8, \# pure nickel approx

) -\> float:

\"\"\"

R = rho \* L / A

dimensions in mm, converted to meters

\"\"\"

length_m = length_mm / 1000.0

area_m2 = (width_mm / 1000.0) \* (thickness_mm / 1000.0)

if area_m2 \<= 0:

raise ValueError(\"Width and thickness must be positive.\")

return resistivity_ohm_m \* length_m / area_m2

\#
\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--

\# Example topology builders

\#
\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--

def build_4p_h_topology() -\> Tuple\[ParallelPackModel, Dict\[str,
str\], str\]:

\"\"\"

4P H-type conceptual topology.

Cells:

C1, C2, C3, C4

Graph nodes:

n1, n2, n3, n4 : cell connection points

center : common H bus

out : external output point

\"\"\"

model = ParallelPackModel()

for name in \[\"C1\", \"C2\", \"C3\", \"C4\"\]:

model.add_cell(Cell(name=name, ocv_v=4.0, internal_res_ohm=0.020))

\# Branches from each cell node to center bus

branch_r = nickel_resistance(length_mm=10, width_mm=7,
thickness_mm=0.15)

for idx in range(1, 5):

model.add_edge(Edge(start=f\"n{idx}\", end=\"center\",
resistance_ohm=branch_r, label=f\"branch\_{idx}\"))

\# Center bus to output

trunk_r = nickel_resistance(length_mm=8, width_mm=8, thickness_mm=0.15)

model.add_edge(Edge(start=\"center\", end=\"out\",
resistance_ohm=trunk_r, label=\"trunk\"))

mapping = {

\"C1\": \"n1\",

\"C2\": \"n2\",

\"C3\": \"n3\",

\"C4\": \"n4\",

}

return model, mapping, \"out\"

def build_5p_line_center_output_topology() -\> Tuple\[ParallelPackModel,
Dict\[str, str\], str\]:

\"\"\"

5P straight line with center output.

This often favors the center cell unless compensated.

\"\"\"

model = ParallelPackModel()

for name in \[\"C1\", \"C2\", \"C3\", \"C4\", \"C5\"\]:

model.add_cell(Cell(name=name, ocv_v=4.0, internal_res_ohm=0.020))

\# Line bus: n1 - n2 - n3 - n4 - n5

seg_r = nickel_resistance(length_mm=15, width_mm=7, thickness_mm=0.15)

model.add_edge(Edge(\"n1\", \"n2\", seg_r, \"seg12\"))

model.add_edge(Edge(\"n2\", \"n3\", seg_r, \"seg23\"))

model.add_edge(Edge(\"n3\", \"n4\", seg_r, \"seg34\"))

model.add_edge(Edge(\"n4\", \"n5\", seg_r, \"seg45\"))

\# Center output from n3

out_r = nickel_resistance(length_mm=5, width_mm=8, thickness_mm=0.15)

model.add_edge(Edge(\"n3\", \"out\", out_r, \"center_out\"))

mapping = {

\"C1\": \"n1\",

\"C2\": \"n2\",

\"C3\": \"n3\",

\"C4\": \"n4\",

\"C5\": \"n5\",

}

return model, mapping, \"out\"

def build_5p_compensated_topology() -\> Tuple\[ParallelPackModel,
Dict\[str, str\], str\]:

\"\"\"

5P compensated topology:

Adds extra resistance to center branch to reduce center-cell favoritism.

\"\"\"

model = ParallelPackModel()

for name in \[\"C1\", \"C2\", \"C3\", \"C4\", \"C5\"\]:

model.add_cell(Cell(name=name, ocv_v=4.0, internal_res_ohm=0.020))

\# Star-like branches to common center_bus

outer_r = nickel_resistance(length_mm=12, width_mm=7, thickness_mm=0.15)

center_r = nickel_resistance(length_mm=18, width_mm=5,
thickness_mm=0.15) \# deliberate compensation

model.add_edge(Edge(\"n1\", \"center_bus\", outer_r, \"branch1\"))

model.add_edge(Edge(\"n2\", \"center_bus\", outer_r, \"branch2\"))

model.add_edge(Edge(\"n3\", \"center_bus\", center_r, \"branch3_comp\"))

model.add_edge(Edge(\"n4\", \"center_bus\", outer_r, \"branch4\"))

model.add_edge(Edge(\"n5\", \"center_bus\", outer_r, \"branch5\"))

trunk_r = nickel_resistance(length_mm=6, width_mm=8, thickness_mm=0.15)

model.add_edge(Edge(\"center_bus\", \"out\", trunk_r, \"out_trunk\"))

mapping = {

\"C1\": \"n1\",

\"C2\": \"n2\",

\"C3\": \"n3\",

\"C4\": \"n4\",

\"C5\": \"n5\",

}

return model, mapping, \"out\"

\#
\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--

\# Reporting

\#
\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\-\--

def print_analysis(

title: str,

model: ParallelPackModel,

mapping: Dict\[str, str\],

bus_node: str,

load_current_a: float,

) -\> None:

print(\"=\" \* 72)

print(title)

print(\"=\" \* 72)

resistances = model.effective_cell_series_resistance(mapping, bus_node)

currents = model.current_distribution(mapping, bus_node, load_current_a)

metrics = model.evaluate_balance(mapping, bus_node, load_current_a)

print(\"\\n\[Cell Series Resistances\]\")

for k in sorted(resistances):

print(f\"{k:\>3}: {resistances\[k\]\*1000:.3f} mOhm\")

print(\"\\n\[Current Distribution\]\")

for k in sorted(currents):

print(f\"{k:\>3}: {currents\[k\]:.3f} A\")

print(\"\\n\[Balance Metrics\]\")

print(f\"Mean current : {metrics\[\'mean_current_a\'\]:.3f} A\")

print(f\"Max deviation : {metrics\[\'max_deviation_a\'\]:.3f} A\")

print(f\"Std deviation : {metrics\[\'std_dev_a\'\]:.3f} A\")

print(f\"Imbalance percent : {metrics\[\'imbalance_pct\'\]:.2f} %\")

print()

def main() -\> None:

load_current_a = 50.0

\# 4P H topology

model_4p, mapping_4p, out_4p = build_4p_h_topology()

print_analysis(\"4P H-Type Topology\", model_4p, mapping_4p, out_4p,
load_current_a)

\# 5P straight line center output

model_5p_line, mapping_5p_line, out_5p_line =
build_5p_line_center_output_topology()

print_analysis(\"5P Straight Line Center Output\", model_5p_line,
mapping_5p_line, out_5p_line, load_current_a)

\# 5P compensated

model_5p_comp, mapping_5p_comp, out_5p_comp =
build_5p_compensated_topology()

print_analysis(\"5P Compensated Topology\", model_5p_comp,
mapping_5p_comp, out_5p_comp, load_current_a)

if \_\_name\_\_ == \"\_\_main\_\_\":

main()

------------------------------------------------------------------------

**4. 이 소스의 의미**

이 프로그램은 완전한 3차원 전자계 해석기는 아니지만, 지금까지 논의한
이론을 실제로 코드로 옮긴 첫 단계로는 충분히 맞습니다.

핵심은 다음입니다.

**4-1. 왜 그래프 모델을 썼는가**

니켈 플레이트 형상을 CAD처럼 바로 해석하기보다,\
전기적으로 중요한 것은 "어디서 어디까지 얼마의 저항인가"이므로 그래프가
적합합니다.

**4-2. 왜 Dijkstra를 썼는가**

초기 설계 비교 단계에서는 "각 셀에서 공통 노드까지의 경로저항" 비교가
매우 유용합니다.\
정밀 FEM 전 단계의 빠른 선별기로 적합합니다.

**4-3. 왜 5P 보정형 예시를 넣었는가**

홀수 병렬에서는 중앙 셀 편중 문제가 생기므로, 프로그램적으로도 "중앙
branch 보정" 개념이 반드시 들어가야 하기 때문입니다.

------------------------------------------------------------------------

**5. 더 정확하게 확장하려면**

지금 코드는 "최단 경로 기반 근사"입니다.\
실제로 더 정확하게 하려면 다음으로 확장하면 됩니다.

**확장 1: 노달 해석**

그래프 전체에 대해 Kirchhoff 법칙으로 선형 방정식을 세워 풀면 됩니다.

즉 각 노드 전압 (V_i)에 대해:

\[\
\\sum \\frac{V_i - V_j}{R\_{ij}} = I_i\
\]

형태의 행렬식을 만들어 풉니다.

그럼 프레임형처럼 다중 경로가 있는 구조도 더 정확히 해석됩니다.

**확장 2: 양극/음극 동시 모델링**

지금 예시는 단일 경로 설명용입니다.\
실제는 플러스 니켈망과 마이너스 니켈망을 둘 다 모델링하고, 셀
내부저항으로 연결해야 합니다.

**확장 3: 최적화**

scipy.optimize 같은 것으로 아래 목적함수를 최소화하면 됩니다.

\[\
J = \\sum (I_k - \\bar{I})\^2\
\]

최적화 변수:

- 니켈 폭

- 니켈 길이

- branch 위치

- 인출점 위치

- neck 폭

**확장 4: 열 모델 결합**

각 엣지의 발열:

\[\
P = I\^2 R\
\]

로 계산해서 hotspot까지 추정할 수 있습니다.

------------------------------------------------------------------------

**6. 실무용 아키텍처 추천**

실제로 개발한다면 아래 구조가 좋습니다.

**입력**

- 셀 수: 4P, 5P, 6P \...

- 셀 배열 좌표

- 니켈 두께/폭/길이

- 인출점 위치

- 용접점 수

- 셀 내부저항 편차

**엔진**

- 형상 → 그래프 변환

- 저항 계산

- 노달 해석

- 전류 분배 계산

- 발열 계산

- 불균형도 계산

**출력**

- 셀별 전류

- 셀별 경로저항

- 최대 편차 %

- hotspot 구간

- 설계 개선 제안

------------------------------------------------------------------------

실행항목:

1.  위 Python 소스를 기준으로 먼저 **4P / 5P 형상 비교 시뮬레이터**를
    만드시는 것이 첫 단계입니다.

2.  다음 단계에서는 **양극망 + 음극망 동시 해석** 구조로 확장해야 실제
    팩 설계용 도구가 됩니다.

3.  최종적으로는 **노달 해석 + 최적화 + 열계산**을 결합해야 설계 자동화
    프로그램이 됩니다.

원하시면 다음 답변에서 바로 이어서 **이 코드를 실제 설계툴 형태로
발전시킨 버전(입력 좌표 기반 자동 해석, CSV 출력 포함)** 으로
완성해드리겠습니다.
