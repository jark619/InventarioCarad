'use client';
import {useEffect,useState}from'react';import{supabase}from'@/lib/supabase/client';
type ProfileName = { full_name: string | null };

export default function Profile(){const[n,setN]=useState('');useEffect(()=>{supabase().from('profiles').select('full_name').single().then(({data})=>setN((data as ProfileName|null)?.full_name||''))},[]);const saveProfile=()=>{const updateProfile=supabase().rpc as unknown as (fn:'update_my_profile',args:{p_full_name:string})=>PromiseLike<unknown>;return updateProfile('update_my_profile',{p_full_name:n})};return <main className="mx-auto max-w-xl p-5"><h1 className="text-2xl font-bold">Mi perfil</h1><input className="mt-5 w-full" value={n} onChange={e=>setN(e.target.value)} placeholder="Nombre y apellidos"/><button onClick={()=>saveProfile()} className="mt-3 bg-blue-600 text-white">Guardar perfil</button></main>}
