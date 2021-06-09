/**
 * Most code (raymarching, noise and lighting) credited to iq [ https://www.shadertoy.com/view/Xds3zN ]
 */

#ifdef GL_ES
precision mediump float;
#endif

uniform float nscale;
uniform vec3 npos;
uniform float niso;
uniform vec2 iResolution;
uniform vec2 iMouse;

/// SHADER TOY ///////////////////////////// 

const float MarchDumping = .8;
const float Far = 38.925;
const int MaxSteps = 128;
const float CameraSize = 3.0;

#define M_NONE -1.0
#define M_NOISE 1.0
#define M_SCREEN 2.0

#define rad(x) (0.01745*(x))

// SDF ////////////////////////////////////////////////////////////
vec2 opU( vec2 d1, vec2 d2 )
{
	return (d1.x<d2.x) ? d1 : d2;
}

float sdSphere( vec3 p, float s )
{
    return length(p)-s;
}

float sdPlane( vec3 p, vec3 n, float h )
{
  // n must be normalized
  return dot(p,n) + h;
}

float sdBox( vec3 p, vec3 b )
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float sdRoundBox( vec3 p, vec3 b, float r )
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
}

///// FBM //////////////////////////////////////////////////////////////////

float hash(float h) {
	return fract(sin(h) * 43758.5453123);
}

float noise(vec3 x) {
	vec3 p = floor(x);
	vec3 f = fract(x);
	f = f * f * (3.0 - 2.0 * f);

	float n = p.x + p.y * 157.0 + 113.0 * p.z ;
	return mix(
			mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
					mix(hash(n + 157.0), hash(n + 158.0), f.x), f.y),
			mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
					mix(hash(n + 270.0), hash(n + 271.0), f.x), f.y), f.z);
}

float fbm(vec3 p) {
	float f = 0.0;
	f = 0.5000 * noise(p);
	p *= 2.01;
	f += 0.2500 * noise(p);
	p *= 2.02;
	f += 0.1250 * noise(p);
	return f;
}

//////// RAY CASTING ////////////////////////////////////////////////////////////////////////

float noiseDist(vec3 p) {
	// float scale = sin(mo.x) * 0.3+1.;
	p = p / nscale;
	p += npos;
	float iso = (niso+1.) * .1+0.2;
	return (fbm(p) - iso) * nscale;
}

vec2 map(vec3 p) {
	vec2 res = vec2(1e10, M_NONE);
	vec2 noise = vec2(noiseDist(p), M_NOISE);
	float sp = sdSphere(p, 3.5);
	float bo = sdBox(p+vec3(0,0,1.0), vec3(5, 5, 4.2));
	vec2 sphere = bo < sp ? vec2(sp, M_NOISE) : vec2(bo, M_SCREEN);
	res = opU( res,  sphere.x > noise.x ? sphere : noise);
  return res;
}

vec2 castRay(vec3 ro, vec3 rd) {
	float tmin = 0.0;
	float tmax = Far;

	float precis = 0.002;
	float t = tmin;
	float m = M_NONE;

	for (int i = 0; i < MaxSteps; i++) {
		vec2 res = map(ro + rd * t);
		if (res.x < precis || t > tmax) {
			break;
		}
		t += res.x * MarchDumping;
		m = res.y;
	}
	if (t > tmax) {
		m = M_NONE;
	}
	return vec2(t, m);
}

///// RENDER //////////////////////////////////////////////////////////////////

float softshadow(vec3 ro, vec3 rd, float mint, float tmax) {
	float res = 1.0;
	float t = mint;

	for (int i = 0; i < 16; i++) {
		float h = map(ro + rd * t).x;

		res = min(res, 8.0 * h / t);
		t += clamp(h, 0.02, 0.10);

		if (h < 0.001 || t > tmax) {
			break;
		}
	}
	return clamp(res, 0.0, 1.0);
}

vec3 calcNormal(vec3 pos) {
	vec2 eps = vec2(0.001, 0.0);

	vec3 nor = vec3(map(pos + eps.xyy).x - map(pos - eps.xyy).x,
			map(pos + eps.yxy).x - map(pos - eps.yxy).x,
			map(pos + eps.yyx).x - map(pos - eps.yyx).x);
	return normalize(nor);
}

vec3 render(vec3 ro, vec3 rd, float ypct) {
	// bg gradient
	vec3 col = mix(vec3(1.00, 0.68, 0.81), vec3(1.00, 0.87, 0.92), ypct);
	vec2 res = castRay(ro, rd);
	float t = res.x;
	float m = res.y;

	if (m > -0.5) {
		vec3 pos = ro + t * rd;
		vec3 nor = calcNormal(pos);

		// colors
		t -= CameraSize;

		// material
		col = vec3(0.50, 0.70, 1.00);

		// lighitng
		vec3 lig = -rd;
		float dif = clamp(dot(nor, vec3(0.,1.,1.)), 0.0, 1.0); // sun
		float dif2 = clamp(dot(nor, lig), 0.0, 1.0);  // cam
		float fre = pow(clamp(1.0 + dot(nor, rd), 0.0, 1.0), 2.0);
		nor = normalize(nor - normalize(pos) * 0.2);

		vec3 brdf = vec3(0.0);
		brdf += (dif*.5+dif2*.5) * vec3(1.00);
        brdf *= softshadow(pos, lig, 0.02, 2.5);
		brdf += .30 * fre * vec3(1.00, 0.68, 0.81) * 1.0;

		col = brdf * col * m;
		col += .35 * vec3(0.98, 0.79, 0.84) * 1.0;  // amb
	}
	return vec3(clamp(col, 0.0, 1.0));
}

void main() {
	vec2 p =  (1.0 * gl_FragCoord.xy - iResolution.xy)  / iResolution.y;
	vec2 mo = iMouse / iResolution.xy;

	vec3 ta = vec3(0.);
    float an = rad(20.+ mo.x * 140.);
	vec3 ro = ta + vec3( 3.5*cos(an), (mo.y - 0.5) * -8.0,3.5*sin(an) );
	// vec3 ro = vec3(0.,0.,1.); 	// 45 deg
	vec3 rd = normalize(ta - ro);
	vec3 cr = cross(rd, vec3(0.0, 1.0, 0.0));  // c right
	vec3 cu = cross(cr, rd);  // c up
	ro = ro + cr * p.x + cu * p.y;  // ortho projection
	ro = ro*CameraSize + vec3(0,0.,2.);  // view box size
	
	vec3 col = render(ro, rd, gl_FragCoord.y / iResolution.y);

	gl_FragColor = vec4(col, 1.0);
}