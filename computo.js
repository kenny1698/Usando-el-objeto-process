const calculo = (msg) => {
    // let sum = 0
    const cantArray=[]
    const obj =[]
    let count = 1
    for(let i=0; i<msg; i++) {
        cantArray.push(Math.floor(Math.random() * (1000 - 1) + 1))
     }
    //return cantArray
    let unicos = [...new Set(cantArray)]

    for(let y=0; y<unicos.length; y++) {
        for(let x=0; x<cantArray.length; x++) {
            if(unicos[y] == cantArray[x] && x!=y)
                count++
        }
        obj.push({'random':unicos[y], 'cantidad':count})
        count = 1
    }
    
    return obj
}

process.on('message', msg => {
    const sum = calculo(msg)
    process.send(sum)
})
